'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { CardHeadTile } from '@/components/common/CardHeadTile';
import { Button } from '@/components/ui/button';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  emailBrandingLabel,
  type EmailBranding,
  type EmailTemplateDto,
} from '@/lib/email/compose-branding';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

type Draft = {
  name: string;
  description: string;
  subject: string;
  bodyText: string;
  branding: EmailBranding;
};

const EMPTY_DRAFT: Draft = {
  name: '',
  description: '',
  subject: '',
  bodyText: '',
  branding: 'sbc',
};

type Props = {
  selectedId: string | null;
  onApply: (template: EmailTemplateDto) => void;
  onClear: () => void;
};

export function ComposeTemplatePanel({ selectedId, onApply, onClear }: Props) {
  const [templates, setTemplates] = useState<EmailTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<'create' | EmailTemplateDto | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  /** The template whose inline delete confirm is open. */
  const [asking, setAsking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/email-templates');
      const json = (await res.json()) as { templates?: EmailTemplateDto[]; error?: string };
      if (!res.ok) throw new Error(json.error || 'templates_failed');
      setTemplates(json.templates ?? []);
    } catch (err) {
      toastError('Could not load templates', errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setEditor('create');
  }

  function openEdit(template: EmailTemplateDto) {
    setDraft({
      name: template.name,
      description: template.description ?? '',
      subject: template.subject,
      bodyText: template.bodyText,
      branding: template.branding,
    });
    setEditor(template);
  }

  async function save() {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.bodyText.trim()) {
      toastError('Template incomplete', 'Add a name, subject, and message.');
      return;
    }
    setSaving(true);
    try {
      const editing = editor !== 'create' && editor !== null ? editor : null;
      const res = await fetch(
        editing ? `/api/email-templates/${editing.id}` : '/api/email-templates',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: draft.name.trim(),
            description: draft.description.trim() || null,
            subject: draft.subject.trim(),
            bodyText: draft.bodyText,
            branding: draft.branding,
            isActive: true,
          }),
        },
      );
      const json = (await res.json()) as { template?: EmailTemplateDto; error?: string };
      if (!res.ok || !json.template) throw new Error(json.error || 'save_failed');
      toastSuccess(editing ? 'Template updated' : 'Template created', json.template.name);
      setEditor(null);
      await load();
      if (!editing || selectedId === json.template.id) onApply(json.template);
    } catch (err) {
      toastError('Could not save template', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  /** Esc on either confirm button closes the delete question. */
  function cancelOnEscape(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setAsking(null);
    }
  }

  async function remove(template: EmailTemplateDto) {
    try {
      const res = await fetch(`/api/email-templates/${template.id}`, { method: 'DELETE' });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error || 'delete_failed');
      toastSuccess('Template deleted', template.name);
      if (selectedId === template.id) onClear();
      await load();
    } catch (err) {
      toastError('Could not delete template', errorMessage(err));
    }
  }

  return (
    <>
      {/* Spectrum section card (prototype EmailScreen "Templates"): a 52px head with Create, then
          flush rows. Delete asks first in the row itself (R-40) instead of a browser prompt. */}
      <section className="surface min-w-0 overflow-hidden" aria-label="Templates">
        <div className="flex min-h-[52px] items-center gap-2.5 border-b border-line-soft px-4 py-2">
          <CardHeadTile title="Templates" />
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Templates</h2>
          <Button type="button" variant="secondary" size="sm" onClick={openCreate}>
            <Plus aria-hidden />
            Create
          </Button>
        </div>

        {loading ? (
          <SkeletonRows rows={3} className="p-4" />
        ) : templates.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No templates yet"
              action={
                <Button type="button" size="sm" onClick={openCreate}>
                  <Plus aria-hidden />
                  Create a template
                </Button>
              }
            />
          </div>
        ) : (
          <ul aria-label="Email templates">
            <li className="border-b border-line-soft">
              <button
                type="button"
                onClick={onClear}
                aria-pressed={selectedId === null}
                className={cn(
                  'flex w-full items-center px-4 py-2.5 text-left text-[13.5px] text-ink-muted hover:bg-surface-sunken',
                  selectedId === null && 'bg-brand-soft text-brand-text hover:bg-brand-soft',
                )}
              >
                Write without a template
              </button>
            </li>
            {templates.map((template) => {
              const selected = selectedId === template.id;
              return (
                <li key={template.id} className="border-b border-line-soft last:border-b-0">
                  <div
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken',
                      selected && 'bg-brand-soft hover:bg-brand-soft',
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      aria-pressed={selected}
                      onClick={() => onApply(template)}
                    >
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {template.name}
                      </span>
                      <span className="block truncate text-[12px] text-ink-muted">
                        {emailBrandingLabel(template.branding)}
                      </span>
                    </button>
                    {template.canMutate ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(template)}
                          className="text-[13px] font-medium text-brand-text hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setAsking(template.id)}
                          className="text-[13px] font-medium text-danger hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                  {asking === template.id ? (
                    // Prototype InlineConfirm (R-40): the question on a grey fill, the main
                    // button first, Cancel after it, Esc cancels.
                    <div
                      role="alertdialog"
                      aria-label={`Delete “${template.name}”?`}
                      className="flex flex-wrap items-center gap-2.5 border-t border-line-soft bg-surface-sunken px-4 py-2.5"
                    >
                      <span className="min-w-0 flex-1 text-[13px] font-medium text-ink">
                        Delete “{template.name}”?
                      </span>
                      <span className="flex flex-none items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onKeyDown={cancelOnEscape}
                          onClick={() => {
                            setAsking(null);
                            void remove(template);
                          }}
                        >
                          Delete
                        </Button>
                        <Button type="button" variant="outline" size="sm" onKeyDown={cancelOnEscape} onClick={() => setAsking(null)}>
                          Cancel
                        </Button>
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={editor !== null} onOpenChange={(open) => { if (!open) setEditor(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editor === 'create' || editor === null ? 'New template' : 'Edit template'}
            </DialogTitle>
          </DialogHeader>

          {/* Prototype TemplateDialog: Name and Style side by side from sm, Subject, then the
              message with its merge-field hint. A stored description is kept on save. */}
          <div className="grid gap-3.5">
            <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_160px]">
              <div className="space-y-1">
                <Label htmlFor="tpl-name">Name</Label>
                <Input
                  id="tpl-name"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  maxLength={120}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tpl-style">Style</Label>
                <Select
                  value={draft.branding}
                  onValueChange={(v) => setDraft((d) => ({ ...d, branding: v as EmailBranding }))}
                >
                  <SelectTrigger id="tpl-style" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sbc">{emailBrandingLabel('sbc')}</SelectItem>
                    <SelectItem value="plain">{emailBrandingLabel('plain')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-subject">Subject</Label>
              <Input
                id="tpl-subject"
                value={draft.subject}
                onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                maxLength={500}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-body">Message</Label>
              <Textarea
                id="tpl-body"
                rows={9}
                className="min-h-[140px]"
                value={draft.bodyText}
                onChange={(e) => setDraft((d) => ({ ...d, bodyText: e.target.value }))}
                maxLength={20000}
                aria-describedby="tpl-body-hint"
              />
              <p id="tpl-body-hint" className="text-[12px] text-ink-muted">
                Fields: {'{client}'}, {'{name}'}, {'{step}'}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditor(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={saving || !draft.name.trim() || !draft.subject.trim()}
            >
              {saving ? 'Saving' : 'Save template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

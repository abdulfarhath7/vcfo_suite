'use client';

import { useEffect, useState } from 'react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { AccentButton } from '@/components/noir/AccentButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

  async function remove(template: EmailTemplateDto) {
    if (!window.confirm(`Delete template “${template.name}”? This cannot be undone.`)) return;
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl tracking-tight">Templates</h2>
        </div>
        <AccentButton type="button" variant="outline" size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Create
        </AccentButton>
      </div>

      {loading ? (
        <p className="mt-6 text-[13px] text-muted-foreground">Loading templates…</p>
      ) : templates.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-primary/20 bg-primary-light/30 px-5 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-panel">
            <FileText className="h-5 w-5 text-brand" aria-hidden />
          </div>
          <h3 className="font-serif text-lg text-foreground">No templates yet</h3>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <AccentButton type="button" variant="outline" disabled>
              Choose a template
            </AccentButton>
            <AccentButton type="button" onClick={openCreate}>
              Create a template
            </AccentButton>
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-2" aria-label="Email templates">
          {templates.map((template) => {
            const selected = selectedId === template.id;
            return (
              <li key={template.id}>
                <div
                  className={cn(
                    'rounded-xl border px-3 py-3',
                    selected ? 'border-primary/40 bg-primary-light/40' : 'border-border bg-panel',
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onApply(template)}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-foreground">
                          {template.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                          {template.subject}
                        </span>
                      </span>
                      <Badge variant={template.branding === 'sbc' ? 'soft' : 'outline'}>
                        {emailBrandingLabel(template.branding)}
                      </Badge>
                    </span>
                  </button>
                  <div className="mt-2 flex items-center justify-end gap-1">
                    {template.canMutate ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(template)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void remove(template)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={editor !== null} onOpenChange={(open) => { if (!open) setEditor(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editor === 'create' || editor === null ? 'Create a template' : 'Edit template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                maxLength={120}
                placeholder="Client kickoff — SBC"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-desc">Description (optional)</Label>
              <Input
                id="tpl-desc"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                maxLength={500}
                placeholder="When to use this template"
              />
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
                className="min-h-[140px]"
                value={draft.bodyText}
                onChange={(e) => setDraft((d) => ({ ...d, bodyText: e.target.value }))}
                maxLength={20000}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Branding</legend>
              <RadioGroup
                value={draft.branding}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, branding: v as EmailBranding }))
                }
                className="gap-2"
              >
                <div className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2">
                  <RadioGroupItem value="sbc" id="brand-sbc" className="mt-0.5" />
                  <Label htmlFor="brand-sbc" className="cursor-pointer font-normal">
                    <span className="block text-[13px] font-medium">SBC branded</span>
                  </Label>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2">
                  <RadioGroupItem value="plain" id="brand-plain" className="mt-0.5" />
                  <Label htmlFor="brand-plain" className="cursor-pointer font-normal">
                    <span className="block text-[13px] font-medium">Plain</span>
                  </Label>
                </div>
              </RadioGroup>
            </fieldset>
          </div>

          <DialogFooter className="gap-2">
            <AccentButton type="button" variant="ghost" onClick={() => setEditor(null)} disabled={saving}>
              Cancel
            </AccentButton>
            <AccentButton type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving' : editor === 'create' || editor === null ? 'Create template' : 'Save'}
            </AccentButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

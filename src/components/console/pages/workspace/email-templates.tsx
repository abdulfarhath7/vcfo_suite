'use client';

/**
 * Email templates (prototype a59s "templates as a gallery" + mxTplEdit; live
 * ComposeTemplatePanel): the Blank card, one card per template with its
 * branding, Edit / Delete where the API allows it (`canMutate`: managers any,
 * leads their own), and New template. Same API, same rules, same messages:
 * GET / POST /api/email-templates, PATCH / DELETE /api/email-templates/:id.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { emailBrandingLabel, type EmailBranding, type EmailTemplateDto } from '@/lib/email/compose-branding';
import { errorMessage } from '@/lib/toast-errors';
import { useConsole } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn, Icon, Seg } from '../../ui';
import { ConfirmBox, fetchJson } from './shared';

export const TEMPLATES_KEY = ['email-templates'] as const;

export function useEmailTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: async (): Promise<EmailTemplateDto[]> => {
      const json = await fetchJson<{ templates?: EmailTemplateDto[] }>('/api/email-templates');
      return json.templates ?? [];
    },
    staleTime: 30_000,
  });
}

/* ---------------------------------------------------------------- gallery */

export function TemplateGallery({
  appliedId,
  onApply,
  onClear,
}: {
  appliedId: string | null;
  onApply: (t: EmailTemplateDto) => void;
  onClear: () => void;
}) {
  const { openModal } = useConsole();
  const q = useEmailTemplates();
  const templates = q.data ?? [];
  const edit = (t: EmailTemplateDto | null) =>
    openModal(<TemplateEditor initial={t} appliedId={appliedId} onApply={onApply} />, { cls: 'wide', label: t ? 'Edit template' : 'Create a template' });
  const remove = (t: EmailTemplateDto) => openModal(<DeleteTemplate t={t} appliedId={appliedId} onClear={onClear} />, { label: 'Delete template' });
  return (
    <div className="mx-tgal" role="group" aria-label="Email templates">
      <button type="button" className={'glass mx-tcard' + (!appliedId ? ' on' : '')} aria-pressed={!appliedId} onClick={onClear}>
        <span className="mx-ni">
          <Icon name="notes" />
        </span>
        <b>Blank</b>
        <span>Write without a template</span>
      </button>
      {q.isPending ? (
        <div className="glass mx-tcard ws-tstate">
          <span>Loading templates…</span>
        </div>
      ) : q.isError ? (
        <div className="glass mx-tcard ws-tstate" role="alert">
          <b>Could not load templates</b>
          <span>{errorMessage(q.error)}</span>
          <div className="mx-tca">
            <button type="button" className="link" onClick={() => void q.refetch()}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        templates.map((t) => {
          const on = appliedId === t.id;
          return (
            <div key={t.id} className={'glass mx-tcard' + (on ? ' on' : '')}>
              <button type="button" className="mx-tcb" aria-pressed={on} title={t.description?.trim() ? `${t.name} · ${t.description.trim()}` : `${t.name} · ${t.subject}`} onClick={() => onApply(t)}>
                <span className="mx-ni">
                  <Icon name="mail" />
                </span>
                <b className="ws-ell">{t.name}</b>
                <span>{t.subject}</span>
              </button>
              <div className="mx-tca">
                <em className={'ws-brand' + (t.branding === 'sbc' ? ' sbc' : '')} title={t.branding === 'sbc' ? 'Sent on the SBC letterhead' : 'Sent as plain text'}>
                  {emailBrandingLabel(t.branding)}
                </em>
                {t.canMutate ? (
                  <>
                    <i className="sp" />
                    <button type="button" className="link" onClick={() => edit(t)} aria-label={`Edit ${t.name}`}>
                      Edit
                    </button>
                    <button type="button" className="link red" onClick={() => remove(t)} aria-label={`Delete ${t.name}`}>
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })
      )}
      <button type="button" className="mx-tcard add" onClick={() => edit(null)}>
        <Icon name="up" />
        <b>New template</b>
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- editor */

type Draft = { name: string; description: string; subject: string; bodyText: string; branding: EmailBranding };

const EMPTY: Draft = { name: '', description: '', subject: '', bodyText: '', branding: 'sbc' };

function TemplateEditor({ initial, appliedId, onApply }: { initial: EmailTemplateDto | null; appliedId: string | null; onApply: (t: EmailTemplateDto) => void }) {
  const { closeModal, toast } = useConsole();
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(() =>
    initial ? { name: initial.name, description: initial.description ?? '', subject: initial.subject, bodyText: initial.bodyText, branding: initial.branding } : EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ title: string; text: string } | null>(null);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const save = async () => {
    if (!d.name.trim() || !d.subject.trim() || !d.bodyText.trim()) {
      setErr({ title: 'Template incomplete', text: 'Add a name, subject, and message.' });
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(initial ? `/api/email-templates/${initial.id}` : '/api/email-templates', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: d.name.trim(),
          description: d.description.trim() || null,
          subject: d.subject.trim(),
          bodyText: d.bodyText,
          branding: d.branding,
          isActive: true,
        }),
      });
      const json = (await res.json()) as { template?: EmailTemplateDto; error?: string };
      if (!res.ok || !json.template) throw new Error(json.error || 'save_failed');
      const saved = json.template;
      toast(`${initial ? 'Template updated' : 'Template created'} · ${saved.name}`);
      closeModal();
      await qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
      // as live: a new template goes straight into the message; an edit refreshes the one in use
      if (!initial || appliedId === saved.id) onApply(saved);
    } catch (e) {
      setErr({ title: 'Could not save template', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBody
      title={initial ? 'Edit template' : 'Create a template'}
      sub="Shared with the firm: every manager and lead can use it. Leads can change only the templates they made."
      foot={
        <>
          <Btn onClick={closeModal} disabled={busy}>
            Cancel
          </Btn>
          <span className="sp" />
          <Btn cls="pri" ico="check" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : initial ? 'Save' : 'Create template'}
          </Btn>
        </>
      }
    >
      <div className="mx-form2 one">
        <label className="mx-f">
          <span className="mx-fl">Name</span>
          <input className="mx-in" value={d.name} maxLength={120} placeholder="Client kickoff — SBC" onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">Description (optional)</span>
          <input className="mx-in" value={d.description} maxLength={500} placeholder="When to use this template" onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">Subject</span>
          <input className="mx-in" value={d.subject} maxLength={500} onChange={(e) => set({ subject: e.target.value })} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">Message</span>
          <textarea className="mx-in ws-tbody" rows={8} value={d.bodyText} maxLength={20000} onChange={(e) => set({ bodyText: e.target.value })} />
        </label>
        <div className="mx-f">
          <span className="mx-fl" id="ws-tbrand">
            Branding
          </span>
          <Seg<EmailBranding>
            ariaLabel="Branding"
            value={d.branding}
            onChange={(v) => set({ branding: v })}
            options={[
              { value: 'sbc', label: 'SBC branded' },
              { value: 'plain', label: 'Plain' },
            ]}
          />
          <span className="mx-fh">{d.branding === 'sbc' ? 'Sent on the SBC letterhead, with the logo and a footer.' : 'Sent as plain text, with no letterhead.'}</span>
        </div>
      </div>
      {err ? (
        <p className="ws-err" role="alert">
          <b>{err.title}</b> {err.text}
        </p>
      ) : null}
    </ModalBody>
  );
}

/* ---------------------------------------------------------------- delete */

function DeleteTemplate({ t, appliedId, onClear }: { t: EmailTemplateDto; appliedId: string | null; onClear: () => void }) {
  const { toast } = useConsole();
  const qc = useQueryClient();
  return (
    <ConfirmBox
      title={`Delete template “${t.name}”?`}
      sub="This cannot be undone."
      confirm="Delete"
      danger
      onConfirm={async () => {
        try {
          const res = await fetch(`/api/email-templates/${t.id}`, { method: 'DELETE' });
          const json = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok || json.ok === false) throw new Error(json.error || 'delete_failed');
        } catch (e) {
          return `Could not delete template · ${errorMessage(e)}`;
        }
        toast(`Template deleted · ${t.name}`);
        if (appliedId === t.id) onClear();
        await qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
      }}
    />
  );
}

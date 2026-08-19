import { getItem } from '@/data/checklist';
import { siteUrl } from '@/lib/site-url';
import {
  emailCallout,
  emailParagraph,
  escapeHtml,
  renderEmailDocument,
} from '@/lib/email/email-layout';

export type ProgressEmailKind =
  | 'client_submitted'
  | 'client_uploaded'
  | 'lead_requested_review'
  | 'review_accepted'
  | 'review_rejected'
  | 'delivered'
  | 'unlocked'
  | 'docs_shared'
  | 'board_resolution_shared';

export type ProgressEmailCopy = {
  subject: string;
  html: string;
  text: string;
};

function stepTitle(itemId: string): string {
  return getItem(itemId)?.title ?? itemId;
}

function absHref(portalHref: string): string {
  return portalHref.startsWith('http')
    ? portalHref
    : `${siteUrl()}${portalHref.startsWith('/') ? '' : '/'}${portalHref}`;
}

function wrap(
  title: string,
  bodyHtml: string,
  ctaLabel: string,
  href: string,
  eyebrow?: string,
): string {
  return renderEmailDocument({
    title,
    bodyHtml,
    eyebrow: eyebrow ?? 'Project update',
    cta: { label: ctaLabel, href },
  });
}

export function buildProgressEmail(input: {
  kind: ProgressEmailKind;
  companyName: string;
  itemId: string;
  note?: string | null;
  portalHref: string;
  audience: 'client' | 'lead';
  /** Overrides checklist step title (e.g. document request label). */
  title?: string | null;
}): ProgressEmailCopy {
  const step = input.title?.trim() || stepTitle(input.itemId);
  const company = input.companyName;
  const note = input.note?.trim();
  const href = absHref(input.portalHref);

  if (input.kind === 'client_submitted') {
    if (input.audience === 'lead') {
      return {
        subject: `${company}: client submitted “${step}” for review`,
        html: wrap(
          'Client submission ready for review',
          emailParagraph(
            `<strong>${escapeHtml(company)}</strong> submitted <strong>${escapeHtml(step)}</strong> and is waiting for your review.`,
          ) +
            emailParagraph(
              'Open the workspace to accept the submission or request corrections.',
            ),
          'Review in workspace',
          href,
          'Action required',
        ),
        text: `${company} submitted “${step}” for review.\n\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: we received your “${step}” submission`,
      html: wrap(
        'Submission received',
        emailParagraph(
          `Thank you — we received your submission for <strong>${escapeHtml(step)}</strong> on <strong>${escapeHtml(company)}</strong>.`,
        ) +
          emailParagraph(
            'Your engagement team will review it and notify you when it is accepted or if updates are needed.',
          ),
        'Open client portal',
        href,
      ),
      text: `We received your submission for “${step}” on ${company}. Your engagement team will review it next.\n\nOpen: ${href}`,
    };
  }

  if (input.kind === 'client_uploaded') {
    if (input.audience === 'lead') {
      return {
        subject: `${company}: client uploaded “${step}”`,
        html: wrap(
          'Client upload ready for review',
          emailParagraph(
            `<strong>${escapeHtml(company)}</strong> uploaded <strong>${escapeHtml(step)}</strong>.`,
          ) +
            emailParagraph('Open the workspace to review the file.'),
          'Review in workspace',
          href,
          'Action required',
        ),
        text: `${company} uploaded “${step}”.\n\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: we received “${step}”`,
      html: wrap(
        'Upload received',
        emailParagraph(
          `Thank you — we received <strong>${escapeHtml(step)}</strong> for <strong>${escapeHtml(company)}</strong>.`,
        ),
        'Open client portal',
        href,
      ),
      text: `We received “${step}” for ${company}.\n\nOpen: ${href}`,
    };
  }

  if (input.kind === 'lead_requested_review') {
    return {
      subject: `${company}: manager approval requested on “${step}”`,
      html: wrap(
        'Manager approval requested',
        emailParagraph(
          `The project lead requested your approval on <strong>${escapeHtml(step)}</strong> for <strong>${escapeHtml(company)}</strong>.`,
        ) +
          emailParagraph('Open the workspace to accept or request corrections.'),
        'Review in workspace',
        href,
        'Action required',
      ),
      text: `The project lead requested manager approval on “${step}” for ${company}.\n\nOpen: ${href}`,
    };
  }

  if (input.kind === 'review_accepted') {
    if (input.audience === 'lead') {
      return {
        subject: `${company}: “${step}” accepted by manager`,
        html: wrap(
          'Submission accepted',
          emailParagraph(
            `<strong>${escapeHtml(step)}</strong> for <strong>${escapeHtml(company)}</strong> was accepted by the project manager.`,
          ) +
            emailParagraph(
              'You can continue with the next delivery steps in the workspace.',
            ),
          'Open workspace',
          href,
          'Team update',
        ),
        text: `“${step}” for ${company} was accepted by the project manager.\n\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: “${step}” was approved`,
      html: wrap(
        'Submission approved',
        emailParagraph(
          `Good news — <strong>${escapeHtml(step)}</strong> on your <strong>${escapeHtml(company)}</strong> project was approved by your engagement team.`,
        ) +
          emailParagraph('You can track progress and next steps in your client portal.'),
        'Open client portal',
        href,
      ),
      text: `“${step}” was approved by your engagement team.\n\nOpen: ${href}`,
    };
  }

  if (input.kind === 'review_rejected') {
    const noteHtml = note
      ? emailCallout(`<strong>Note from your team:</strong> ${escapeHtml(note)}`)
      : '';
    const noteText = note ? `\nNote: ${note}\n` : '\n';
    if (input.audience === 'lead') {
      return {
        subject: `${company}: corrections requested on “${step}”`,
        html: wrap(
          'Corrections requested',
          emailParagraph(
            `Corrections were requested on <strong>${escapeHtml(step)}</strong> for <strong>${escapeHtml(company)}</strong>.`,
          ) +
            noteHtml +
            emailParagraph('Please coordinate the updates so the client can resubmit.'),
          'Open workspace',
          href,
          'Action required',
        ),
        text: `Corrections requested on “${step}” for ${company}.${noteText}\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: updates needed on “${step}”`,
      html: wrap(
        'Updates needed',
        emailParagraph(
          `Your engagement team requested updates on <strong>${escapeHtml(step)}</strong>.`,
        ) +
          noteHtml +
          emailParagraph('Please revise the details in your portal and resubmit when ready.'),
        'Open client portal',
        href,
        'Action required',
      ),
      text: `Updates needed on “${step}”.${noteText}\nOpen: ${href}`,
    };
  }

  if (input.kind === 'delivered') {
    if (input.audience === 'lead') {
      return {
        subject: `${company}: “${step}” delivered to client`,
        html: wrap(
          'Delivered to client',
          emailParagraph(
            `<strong>${escapeHtml(step)}</strong> was marked delivered for <strong>${escapeHtml(company)}</strong>.`,
          ),
          'Open workspace',
          href,
        ),
        text: `“${step}” was delivered to the client for ${company}.\n\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: “${step}” is ready for you`,
      html: wrap(
        'Ready on your portal',
        emailParagraph(
          `<strong>${escapeHtml(step)}</strong> is ready on your client portal.`,
        ) + emailParagraph('Please review the materials and complete any remaining actions.'),
        'Open client portal',
        href,
      ),
      text: `“${step}” is ready on your client portal.\n\nOpen: ${href}`,
    };
  }

  if (input.kind === 'unlocked') {
    if (input.audience === 'lead') {
      return {
        subject: `${company}: fields unlocked on “${step}”`,
        html: wrap(
          'Fields unlocked for client',
          emailParagraph(
            `Client fields were unlocked on <strong>${escapeHtml(step)}</strong> for <strong>${escapeHtml(company)}</strong>.`,
          ),
          'Open workspace',
          href,
        ),
        text: `Client fields unlocked on “${step}” for ${company}.\n\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: you can update “${step}” again`,
      html: wrap(
        'Fields unlocked',
        emailParagraph(
          `Your team unlocked fields on <strong>${escapeHtml(step)}</strong> so you can update and resubmit.`,
        ),
        'Open client portal',
        href,
        'Action required',
      ),
      text: `Fields on “${step}” were unlocked so you can update and resubmit.\n\nOpen: ${href}`,
    };
  }

  if (input.kind === 'board_resolution_shared') {
    if (input.audience === 'lead') {
      return {
        subject: `${company}: board resolution sent to client`,
        html: wrap(
          'Board resolution sent to client',
          emailParagraph(
            `The certified board resolution for <strong>${escapeHtml(company)}</strong> was released to the client.`,
          ),
          'Open workspace',
          href,
        ),
        text: `The board resolution for ${company} was released to the client.\n\nOpen: ${href}`,
      };
    }
    return {
      subject: `${company}: board resolution is ready to download and sign`,
      html: wrap(
        'Board resolution ready',
        emailParagraph(
          'The certified board resolution is ready on your portal.',
        ) +
          emailParagraph(
            'Download the Word document, sign it on company letterhead, then scan and upload the signed copy.',
          ),
        'Open board resolution',
        href,
        'Action required',
      ),
      text: `The board resolution is ready to download and sign.\n\nOpen: ${href}`,
    };
  }

  // docs_shared
  if (input.audience === 'lead') {
    return {
      subject: `${company}: incorporation drafts shared with client`,
      html: wrap(
        'Drafts shared with client',
        emailParagraph(
          `Incorporation drafts for <strong>${escapeHtml(company)}</strong> were shared with the client portal.`,
        ),
        'Open workspace',
        href,
      ),
      text: `Incorporation drafts for ${company} were shared with the client.\n\nOpen: ${href}`,
    };
  }
  return {
    subject: `${company}: incorporation drafts are available`,
    html: wrap(
      'Drafts available',
      emailParagraph(
        'Your incorporation drafts are available to download (and upload signed copies) on your portal.',
      ),
      'Open client portal',
      href,
    ),
    text: `Your incorporation drafts are available on your portal.\n\nOpen: ${href}`,
  };
}

/** Document request email (client). */
export function buildDocumentRequestEmail(input: {
  companyName: string;
  title: string;
  note?: string | null;
  portalHref: string;
}): ProgressEmailCopy {
  const href = absHref(input.portalHref);
  const note = input.note?.trim();
  return {
    subject: `${input.companyName}: document requested — ${input.title}`,
    html: wrap(
      'Document requested',
      emailParagraph(
        `Please upload <strong>${escapeHtml(input.title)}</strong> for <strong>${escapeHtml(input.companyName)}</strong>.`,
      ) +
        (note ? emailCallout(`<strong>Note:</strong> ${escapeHtml(note)}`) : '') +
        emailParagraph('Use the client portal to complete this request.'),
      'Open client portal',
      href,
      'Action required',
    ),
    text: `Please upload “${input.title}” for ${input.companyName}.${
      note ? `\n\nNote: ${note}` : ''
    }\n\nOpen: ${href}`,
  };
}

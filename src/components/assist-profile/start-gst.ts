import { GST_FORM_ID } from '@/lib/registrations/gst-profile';

/**
 * "Start on GST portal": the one-button start of the VCFO Assist GST flow, the same mechanism as
 * the SPICe+ Start. The extension reads the open Suite tab to pick the engagement; this marks the
 * tab with the form and the engagement (URL parameters `assist` and `engagement`, data attributes
 * on <html>, and a window message). Suite never opens the portal itself: with the extension
 * installed (it marks the page with `data-vcfo-assist`), its side panel opens the portal in a tab
 * of its own, so a second Suite tab would only be a duplicate; without it there is nothing to fill
 * the portal, so the button shows the install steps instead of a live portal tab. The person signs
 * in there, types the OTPs, authenticates Aadhaar and submits; the extension only fills what the
 * tool holds (`vcfo_assist/docs/gst-profile-contract.md`, "Starting from Suite").
 *
 * Browser only; `win` is injectable for the tests.
 */

export const ASSIST_START_MESSAGE = 'vcfo-assist:start';

/** True when the VCFO Assist extension has marked the page (`<html data-vcfo-assist>`). */
export function assistInstalled(doc: Document = document): boolean {
  return Boolean(doc.documentElement.dataset.vcfoAssist);
}

export function startGstOnPortal(engagementId: string, win: Window = window): { installed: boolean } {
  const url = new URL(win.location.href);
  url.searchParams.set('assist', GST_FORM_ID);
  url.searchParams.set('engagement', engagementId);
  win.history.replaceState(win.history.state, '', url.toString());
  const root = win.document.documentElement;
  root.dataset.vcfoAssistForm = GST_FORM_ID;
  root.dataset.vcfoAssistEngagement = engagementId;
  win.postMessage({ source: 'vcfo-suite', type: ASSIST_START_MESSAGE, form: GST_FORM_ID, engagementId }, win.location.origin);
  return { installed: assistInstalled(win.document) };
}

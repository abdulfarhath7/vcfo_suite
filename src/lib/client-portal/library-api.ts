import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { AuthContext } from '@/auth/guards';
import { ANSWER_DEPTHS, answerEnvelopeSchema, type AnswerDepth } from '@/data/ask/schema';
import { getAskMessage } from '@/db/repositories/ask-messages';
import { deleteLibraryItem, getLibraryItem, listLibraryItems, saveLibraryItem } from '@/db/repositories/client-library';
import { AskForbiddenError } from '@/lib/ask/access';
import { askConfig, askFeatures } from '@/lib/ask/config';
import { toLibraryView, UPDATED_SINCE_SAVED } from '@/lib/ask/library';
import { briefFilename, renderBriefPdf } from '@/lib/ask/pdf-brief';
import { loadProjectSnapshot } from '@/lib/ask/snapshot';
import { applicabilityFromSnapshot, getTopic, resolveTopicForViewer, topicToAnswer } from '@/lib/ask/topics';
import { firmDisplayName } from '@/lib/brand';

/**
 * Library read/save handlers shared by the client-portal routes
 * (/api/client/library/**, NOT behind the Ask VCFO flag — the client's saved
 * books, the reader and its PDF brief work with Ask VCFO off) and the Ask
 * VCFO routes (/api/ask/library/**, which add the feature gate). Only asking
 * a NEW question needs Ask VCFO; reading what was saved, a published topic,
 * or saving a published topic does not.
 *
 * Access control stays in the repositories (Path A): every item is keyed by
 * `ctx.userId`; saves are client-only and engagement-checked.
 */

function forbidden(error: unknown): NextResponse | null {
  if (error instanceof AskForbiddenError) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  return null;
}

/** What the Library page may offer beside the saved books. */
export function libraryFeatures() {
  const enabled = askConfig().enabled;
  return { askEnabled: enabled, statusBrief: enabled && askFeatures().C4 };
}

export async function listLibrary(ctx: AuthContext): Promise<NextResponse> {
  try {
    const rows = await listLibraryItems(ctx);
    return NextResponse.json({
      items: rows.map((row) => toLibraryView(row, { current: false, snapshot: null })),
      features: libraryFeatures(),
    });
  } catch (error) {
    const f = forbidden(error);
    if (f) return f;
    console.error('[library] list failed', error);
    return NextResponse.json({ error: 'Could not load your library' }, { status: 500 });
  }
}

const saveSchema = z.object({
  engagementId: z.string().trim().min(1),
  topicSlug: z.string().trim().min(1).optional(),
  messageId: z.string().uuid().optional(),
  answer: answerEnvelopeSchema.optional(),
});

/**
 * Save an answer. Content is re-derived on the server: a topic save stores
 * the current topic version, a generated answer is read back from the
 * caller's own message — the browser's copy is never trusted as content.
 */
export async function saveToLibrary(ctx: AuthContext, request: Request): Promise<NextResponse> {
  if (ctx.role !== 'client') return NextResponse.json({ error: 'Saving is only available to clients' }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { engagementId, topicSlug, messageId, answer } = parsed.data;
  try {
    let input: Parameters<typeof saveLibraryItem>[1] | null = null;
    if (topicSlug) {
      const topic = getTopic(topicSlug);
      if (!topic || !answer || topic.audience === 'staff') {
        return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
      }
      input = {
        engagementId,
        title: topic.title,
        category: topic.category,
        topicSlug: topic.slug,
        topicVersion: topic.version,
        // Keep the depth and "you are here" the client was looking at.
        answer: { ...answer, topicSlug: topic.slug, topicVersion: topic.version },
      };
    } else if (messageId) {
      const message = await getAskMessage(ctx, messageId);
      const stored = answerEnvelopeSchema.safeParse(message?.answer);
      if (!message || !stored.success) return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
      input = {
        engagementId,
        title: stored.data.title || stored.data.line.slice(0, 120),
        category: 'your-project',
        answer: stored.data,
        messageId: message.id,
      };
    }
    if (!input) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
    const row = await saveLibraryItem(ctx, input);
    if (!row) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ item: toLibraryView(row, { current: false, snapshot: null }) }, { status: 201 });
  } catch (error) {
    const f = forbidden(error);
    if (f) return f;
    console.error('[library] save failed', error);
    return NextResponse.json({ error: 'Could not save to your library' }, { status: 500 });
  }
}

/** Owner read; an updated topic opens at its current version. */
export async function readLibraryItem(ctx: AuthContext, id: string): Promise<NextResponse> {
  try {
    const row = await getLibraryItem(ctx, id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const loaded = await loadProjectSnapshot(ctx, row.engagementId).catch(() => null);
    const view = toLibraryView(row, { current: true, snapshot: loaded?.snapshot ?? null });
    return NextResponse.json({ item: view, notice: view.updated ? UPDATED_SINCE_SAVED : null });
  } catch (error) {
    const f = forbidden(error);
    if (f) return f;
    console.error('[library] read failed', error);
    return NextResponse.json({ error: 'Could not open this item' }, { status: 500 });
  }
}

/** Hard delete, owner only (the portal uses the soft remove with Undo). */
export async function deleteLibrary(ctx: AuthContext, id: string): Promise<NextResponse> {
  if (ctx.role !== 'client') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  try {
    const removed = await deleteLibraryItem(ctx, id);
    if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const f = forbidden(error);
    if (f) return f;
    console.error('[library] delete failed', error);
    return NextResponse.json({ error: 'Could not remove this item' }, { status: 500 });
  }
}

function pdfResponse(pdf: Uint8Array | Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Single-item PDF brief, owner only. */
export async function exportLibraryItem(ctx: AuthContext, id: string): Promise<NextResponse> {
  try {
    const row = await getLibraryItem(ctx, id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const loaded = await loadProjectSnapshot(ctx, row.engagementId).catch(() => null);
    const companyName = loaded?.snapshot.companyName ?? 'Your company';
    const view = toLibraryView(row, { current: true, snapshot: loaded?.snapshot ?? null });
    const pdf = await renderBriefPdf({ items: [{ title: view.title, answer: view.answer }], companyName, firmName: firmDisplayName() });
    return pdfResponse(pdf, briefFilename(companyName, view.title));
  } catch (error) {
    const f = forbidden(error);
    if (f) return f;
    console.error('[library] brief export failed', error);
    return NextResponse.json({ error: 'Could not create the PDF' }, { status: 500 });
  }
}

/** Multi-item PDF brief of the caller's own items (?ids=a,b; none = all). */
export async function exportLibrary(ctx: AuthContext, request: Request): Promise<NextResponse> {
  const ids = new URL(request.url).searchParams.get('ids')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  try {
    const rows = (await listLibraryItems(ctx)).filter((row) => ids.length === 0 || ids.includes(row.id));
    if (rows.length === 0) return NextResponse.json({ error: 'Nothing to export' }, { status: 404 });
    const loaded = await loadProjectSnapshot(ctx, rows[0]!.engagementId).catch(() => null);
    const companyName = loaded?.snapshot.companyName ?? 'Your company';
    const items = rows
      .reverse()
      .map((row) => toLibraryView(row, { current: true, snapshot: loaded?.snapshot ?? null }))
      .map((view) => ({ title: view.title, answer: view.answer }));
    const pdf = await renderBriefPdf({ items, companyName, firmName: firmDisplayName() });
    return pdfResponse(pdf, briefFilename(companyName));
  } catch (error) {
    const f = forbidden(error);
    if (f) return f;
    console.error('[library] brief export failed', error);
    return NextResponse.json({ error: 'Could not create the PDF' }, { status: 500 });
  }
}

/**
 * A reviewed topic as an answer, no model call (the reader for
 * /app/client/learn/[slug] and depth changes on a saved book). With an
 * engagement (client persona) the topic follows alternates and
 * applicability, and flows show "You are here".
 */
export async function readTopic(ctx: AuthContext, slug: string, request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const depthParam = url.searchParams.get('depth') as AnswerDepth | null;
  const depth = depthParam && ANSWER_DEPTHS.includes(depthParam) ? depthParam : 'normal';
  const engagementId = url.searchParams.get('engagementId')?.trim();
  const clientPersona = ctx.role === 'client' || Boolean(engagementId);
  if (ctx.role === 'client' && !engagementId) return NextResponse.json({ error: 'Choose a project first' }, { status: 400 });
  try {
    let snapshot = null;
    if (engagementId) {
      if (ctx.role === 'admin') return NextResponse.json({ error: 'Not available' }, { status: 403 });
      // A malformed or foreign engagement id is "not found", never a 500.
      const loaded = await loadProjectSnapshot(ctx, engagementId).catch(() => null);
      if (!loaded) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      snapshot = loaded.snapshot;
    }
    const topic = resolveTopicForViewer(slug, applicabilityFromSnapshot(snapshot), clientPersona ? 'client' : 'staff');
    if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    const shell = clientPersona ? 'client' : ctx.role === 'super_admin' ? 'super' : 'admin';
    return NextResponse.json({
      topic: { slug: topic.slug, title: topic.title, category: topic.category, version: topic.version },
      answer: topicToAnswer(topic, { depth, shell, snapshot }),
    });
  } catch (error) {
    console.error('[library] topic failed', error);
    return NextResponse.json({ error: 'Could not load this explanation' }, { status: 500 });
  }
}

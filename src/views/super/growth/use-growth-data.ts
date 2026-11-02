'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Prospect, ProspectStage } from '@/lib/growth/pipeline';
import type { DemoRequest } from '@/lib/growth/demo-request';

/**
 * Reads and writes behind the Growth sales pipeline (G-21) and the demo requests list
 * (G-30). Every call goes through the super admin routes under `/api/super/growth/`; the
 * view never touches `db`.
 */
export type { DemoRequest };

export interface ProspectOwner {
  id: string;
  name: string;
  role: string;
}

const PROSPECTS_KEY = ['super-growth-prospects'] as const;
const DEMO_REQUESTS_KEY = ['super-growth-demo-requests'] as const;

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || fallback);
  return data;
}

export function useProspects() {
  return useQuery({
    queryKey: PROSPECTS_KEY,
    queryFn: async () =>
      readJson<{ prospects: Prospect[]; owners: ProspectOwner[] }>(
        await fetch('/api/super/growth/prospects'),
        'Could not load the pipeline',
      ),
    staleTime: 30_000,
  });
}

export function useDemoRequests() {
  return useQuery({
    queryKey: DEMO_REQUESTS_KEY,
    queryFn: async () =>
      (await readJson<{ requests: DemoRequest[] }>(await fetch('/api/super/growth/demo-requests'), 'Could not load demo requests'))
        .requests,
    staleTime: 30_000,
  });
}

export interface ProspectFormValues {
  name: string;
  company: string;
  email: string;
  phone: string;
  source: Prospect['source'];
  stage: ProspectStage;
  service: Prospect['service'] | '';
  ownerId: string;
  notes: string;
  nextStepOn: string;
}

function toBody(v: ProspectFormValues) {
  return {
    name: v.name,
    company: v.company,
    email: v.email,
    phone: v.phone,
    source: v.source,
    stage: v.stage,
    service: v.service || null,
    ownerId: v.ownerId || null,
    notes: v.notes,
    nextStepOn: v.nextStepOn,
  };
}

export function useProspectMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: PROSPECTS_KEY });
  };

  const create = useMutation({
    mutationFn: async (values: ProspectFormValues) =>
      (
        await readJson<{ prospect: Prospect }>(
          await fetch('/api/super/growth/prospects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toBody(values)),
          }),
          'Could not add the prospect',
        )
      ).prospect,
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<ProspectFormValues> | ProspectFormValues }) => {
      const body = 'name' in values && values.name !== undefined ? toBody(values as ProspectFormValues) : values;
      return (
        await readJson<{ prospect: Prospect }>(
          await fetch(`/api/super/growth/prospects/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
          'Could not save the prospect',
        )
      ).prospect;
    },
    onMutate: async ({ id, values }) => {
      // A stage move shows at once; the server reply replaces it.
      if (!values.stage || Object.keys(values).length !== 1) return;
      await qc.cancelQueries({ queryKey: PROSPECTS_KEY });
      qc.setQueryData<{ prospects: Prospect[]; owners: ProspectOwner[] }>(PROSPECTS_KEY, (old) =>
        old
          ? { ...old, prospects: old.prospects.map((p) => (p.id === id ? { ...p, stage: values.stage as ProspectStage } : p)) }
          : old,
      );
    },
    onSettled: refresh,
  });

  const convert = useMutation({
    mutationFn: async ({ id, engagementId }: { id: string; engagementId: string }) =>
      (
        await readJson<{ prospect: Prospect }>(
          await fetch(`/api/super/growth/prospects/${id}/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ engagementId }),
          }),
          'Could not link the client',
        )
      ).prospect,
    onSuccess: refresh,
  });

  const fromDemoRequest = useMutation({
    mutationFn: async (demoRequestId: string) =>
      (
        await readJson<{ prospect: Prospect }>(
          await fetch('/api/super/growth/prospects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ demoRequestId }),
          }),
          'Could not add the prospect',
        )
      ).prospect,
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: DEMO_REQUESTS_KEY });
    },
  });

  return { create, update, convert, fromDemoRequest };
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAssistProfile } from '@/hooks/use-assist-profile';
import { useGstRegistration } from '@/hooks/use-gst-registration';
import type { CardDataSource } from '@/lib/card-agents/card-agents';
import {
  beforeFillStorageKey,
  buildGstBeforeFill,
  buildMcaBeforeFill,
  loadChoices,
  reconcileChoices,
  saveChoices,
  type BeforeFillChoice,
  type BeforeFillChoices,
  type BeforeFillContext,
  type BeforeFillItem,
} from '@/lib/card-agents/before-fill';

/** How often the screen reads the data again while it waits for missing items to arrive. */
const REFRESH_MS = 20_000;

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

/**
 * The data behind "Before I fill" for one task: the GST REG-01 readiness (`gst-profile`) or the
 * VCFO Assist profile for the MCA forms (`mca-profile`). Both queries are declared and only the
 * task's own source is enabled. The screen reads again every 20 seconds and on window focus, so
 * values that arrive (a SharePoint read, the client's answers, a field typed in another tab) move
 * to Ready by themselves. The person's choices are kept per engagement and task in localStorage.
 */
export function useBeforeFill(engagementId: string, taskId: string, dataSource: CardDataSource | null, active = true, sections?: readonly string[] | null) {
  const gst = useGstRegistration(active && dataSource === 'gst-profile' ? engagementId : null);
  const mca = useAssistProfile(active && dataSource === 'mca-profile' ? engagementId : null);
  const query = dataSource === 'gst-profile' ? gst : mca;

  const items = useMemo<BeforeFillItem[] | null>(() => {
    if (dataSource === 'gst-profile') return gst.data ? buildGstBeforeFill(gst.data) : null;
    if (dataSource === 'mca-profile') return mca.data ? buildMcaBeforeFill(mca.data, sections) : null;
    return null;
  }, [dataSource, gst.data, mca.data, sections]);

  const ctx = useMemo<BeforeFillContext>(
    () => ({ sharepoint: dataSource === 'gst-profile', zohoLinked: Boolean(dataSource === 'gst-profile' && gst.data?.zoho.linked) }),
    [dataSource, gst.data?.zoho.linked],
  );

  const key = beforeFillStorageKey(engagementId, taskId);
  const [saved, setSaved] = useState<BeforeFillChoices>(() => loadChoices(storage(), key));
  useEffect(() => setSaved(loadChoices(storage(), key)), [key]);

  const choices = useMemo(() => (items ? reconcileChoices(items, saved, ctx) : {}), [items, saved, ctx]);

  const choose = useCallback(
    (itemKey: string, choice: BeforeFillChoice) => {
      setSaved((cur) => {
        const next = { ...cur, [itemKey]: choice };
        saveChoices(storage(), key, next);
        return next;
      });
    },
    [key],
  );

  /** "Save and come back": writes the choices as they stand. False when the browser refuses storage. */
  const save = useCallback(() => saveChoices(storage(), key, choices), [key, choices]);

  const refetch = query.refetch;
  useEffect(() => {
    if (!active || !dataSource) return;
    const iv = setInterval(() => {
      if (!document.hidden) void refetch();
    }, REFRESH_MS);
    return () => clearInterval(iv);
  }, [active, dataSource, refetch]);

  return {
    items,
    choices,
    choose,
    save,
    ctx,
    loading: query.isPending && Boolean(dataSource),
    error: query.isError ? query.error : null,
    refreshing: query.isFetching,
    refetch,
    gst: dataSource === 'gst-profile' ? gst.data ?? null : null,
    companyName: (dataSource === 'gst-profile' ? gst.data?.view.companyName : mca.data?.companyName) ?? null,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DinSource, McaDinRequest, NormalizedDinData } from "@/lib/din-lookup/types";

/** How often the page asks whether the MCA tab has answered, and how long it keeps asking. */
const POLL_MS = 2_000;
const GIVE_UP_MS = 5 * 60 * 1000;

export interface McaResult {
  data: NormalizedDinData;
  source: DinSource;
  fetchedAt: string;
}

/**
 * The Suite half of the MCA-session read (docs/context/notes/mca-lookup.md). The page asks for
 * a DIN, the VCFO Assist extension picks the request up inside the same person's browser,
 * reads the portal page in their own logged-in MCA tab and posts the record back. This hook
 * only opens the request and waits; it never touches MCA itself.
 */
export function useMcaDinRequest(onResult: (result: McaResult) => void) {
  const [request, setRequest] = useState<McaDinRequest | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);
  /** null until the first answer: is the extension path turned on at all? */
  const [setUp, setSetUp] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  // The latest callback, kept in a ref so the poll loop never restarts when the page re-renders.
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setWaiting(false);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Ask once whether the path exists, so the button can say so before it is pressed rather
  // than answering with an error afterwards.
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/tools/din-lookup/mca?pending=1");
        const json = await res.json().catch(() => ({}));
        if (live) setSetUp(json?.setUp !== false && res.ok);
      } catch {
        if (live) setSetUp(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const poll = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/tools/din-lookup/mca?id=${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error ?? "Lost track of the MCA request.");
          stop();
          return;
        }
        setRequest(json.request);
        if (json.request.state === "done" && json.data) {
          onResultRef.current({ data: json.data, source: json.source ?? "mca-portal", fetchedAt: json.fetchedAt });
          stop();
          return;
        }
        if (json.request.state === "failed" || json.request.state === "cancelled") {
          setError(json.request.error ?? "The MCA read stopped before it finished.");
          stop();
          return;
        }
        if (Date.now() - startedAt.current > GIVE_UP_MS) {
          setError("No answer from the MCA tab in five minutes. Sign in to the MCA portal in another tab, then try again.");
          stop();
          return;
        }
        timer.current = setTimeout(() => void poll(id), POLL_MS);
      } catch {
        setError("Network error while waiting for the MCA tab.");
        stop();
      }
    },
    [stop],
  );

  const ask = useCallback(
    async (din: string) => {
      setError(null);
      setNotSetUp(false);
      setRequest(null);
      setWaiting(true);
      startedAt.current = Date.now();
      try {
        const res = await fetch("/api/tools/din-lookup/mca", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ din }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          if (json.setUp === false) setNotSetUp(true);
          setError(json.error ?? `Could not ask for the MCA read (${res.status}).`);
          setWaiting(false);
          return;
        }
        setRequest(json.request);
        timer.current = setTimeout(() => void poll(json.request.id), POLL_MS);
      } catch {
        setError("Network error — could not reach the server.");
        setWaiting(false);
      }
    },
    [poll],
  );

  const cancel = useCallback(async () => {
    const id = request?.id;
    stop();
    setRequest(null);
    if (!id) return;
    await fetch("/api/tools/din-lookup/mca", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, state: "cancelled" }),
    }).catch(() => undefined);
  }, [request, stop]);

  return { ask, cancel, request, waiting, error, notSetUp, setUp };
}

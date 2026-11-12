// Types for redact.mjs, so the TypeScript tests can import it.
export declare const SECRET_NAME: RegExp;
export declare const NETWORK_FIELDS: string[];
export declare const FORBIDDEN_RECORDER_CODE: RegExp[];
export declare function maskPii(text: string | null | undefined): string;
export declare function stripQuery(url: string): string;
export declare function networkRecord(r: { ts?: string; step?: number; type?: string; method?: string; url: string; status?: number; contentType?: string }): Record<string, unknown>;
export declare function redactHtml(html: string, opts?: { dummyClient?: boolean }): string;
export declare function elementRecord(el: Record<string, unknown>, opts?: { dummyClient?: boolean }): Record<string, unknown>;
export declare function eventRecord(ev: Record<string, unknown>, opts?: { dummyClient?: boolean }): Record<string, unknown> & { target: Record<string, unknown> };

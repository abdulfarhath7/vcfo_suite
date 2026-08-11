import 'server-only';

import PizZip from 'pizzip';
import { SaxesParser } from 'saxes';

function parseWordXmlOrError(xml: string): string | null {
  const parser = new SaxesParser({ xmlns: false }) as SaxesParser<{ xmlns: false }> & {
    onerror: (err: { message: string }) => void;
  };
  let error: string | null = null;
  parser.onerror = (err) => {
    error = err.message;
  };
  try {
    parser.write(xml).close();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return error;
}

/** Fail fast when a generated or downloaded .docx has malformed Word XML. */
export function assertIncorpDocxWordXmlValid(docx: Buffer): void {
  const zip = new PizZip(docx);
  for (const entry of zip.file(/word\/.*\.xml$/)) {
    const error = parseWordXmlOrError(entry.asText());
    if (error) {
      throw new Error(`${entry.name}: ${error}`);
    }
  }
}

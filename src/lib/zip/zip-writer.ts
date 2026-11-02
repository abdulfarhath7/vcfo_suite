import { CRC32_START, crc32Final, crc32Update } from '@/lib/zip/crc32';

/**
 * A small streaming ZIP writer: store only (no compression), so each entry's bytes pass
 * straight through and memory stays flat however large the archive is. Every entry sets
 * general-purpose bit 3, so its CRC-32 and sizes follow the data in a data descriptor and the
 * writer never has to know them in advance. Names are written as UTF-8 (bit 11).
 *
 * There is no ZIP64 support: one entry and the whole archive must stay under 4 GiB, and the
 * archive under 65,535 entries. Callers cap far below that (the vault route allows 500 files
 * or 1 GB), and the writer throws if a limit would be crossed.
 */

/** Something the writer can read bytes from. */
export type ZipByteSource = ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | Iterable<Uint8Array>;

export interface ZipEntrySource {
  /** Path inside the archive, with forward slashes. Use `zipEntryPath` to build a safe one. */
  name: string;
  /** Modified time shown by unzip tools. Defaults to now. */
  modified?: Date;
  /** Open the bytes when the writer reaches this entry. Return null to skip the entry. */
  open: () => Promise<ZipByteSource | null> | ZipByteSource | null;
}

export interface ZipWriterOptions {
  /** Stop with an error when the stored bytes would pass this total. */
  maxBytes?: number;
  /** Called when `open` returns null, so the caller can count missing objects. */
  onSkip?: (name: string) => void;
}

const MAX_U32 = 0xffffffff;
const MAX_ENTRIES = 0xffff;
/** Bit 3 (sizes in a data descriptor) and bit 11 (UTF-8 names). */
const FLAGS = 0x0808;
const VERSION = 20;

const encoder = new TextEncoder();

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function localHeader(name: Uint8Array, stamp: { time: number; date: number }): Uint8Array {
  const out = new Uint8Array(30 + name.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, VERSION, true);
  v.setUint16(6, FLAGS, true);
  v.setUint16(8, 0, true); // method: stored
  v.setUint16(10, stamp.time, true);
  v.setUint16(12, stamp.date, true);
  // CRC-32 and both sizes stay zero here; the data descriptor carries them (bit 3).
  v.setUint16(26, name.length, true);
  v.setUint16(28, 0, true);
  out.set(name, 30);
  return out;
}

function dataDescriptor(crc: number, size: number): Uint8Array {
  const out = new Uint8Array(16);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x08074b50, true);
  v.setUint32(4, crc, true);
  v.setUint32(8, size, true); // compressed size equals the size when stored
  v.setUint32(12, size, true);
  return out;
}

interface CentralRecord {
  name: Uint8Array;
  stamp: { time: number; date: number };
  crc: number;
  size: number;
  offset: number;
}

function centralHeader(r: CentralRecord): Uint8Array {
  const out = new Uint8Array(46 + r.name.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, VERSION, true); // made by: MS-DOS / FAT attributes, spec 2.0
  v.setUint16(6, VERSION, true);
  v.setUint16(8, FLAGS, true);
  v.setUint16(10, 0, true);
  v.setUint16(12, r.stamp.time, true);
  v.setUint16(14, r.stamp.date, true);
  v.setUint32(16, r.crc, true);
  v.setUint32(20, r.size, true);
  v.setUint32(24, r.size, true);
  v.setUint16(28, r.name.length, true);
  // extra length, comment length, disk number, internal and external attributes stay zero.
  v.setUint32(42, r.offset, true);
  out.set(r.name, 46);
  return out;
}

function endOfCentralDirectory(count: number, size: number, offset: number): Uint8Array {
  const out = new Uint8Array(22);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, size, true);
  v.setUint32(16, offset, true);
  return out;
}

async function* chunksOf(source: ZipByteSource): AsyncGenerator<Uint8Array> {
  if (typeof (source as ReadableStream<Uint8Array>).getReader === 'function') {
    const reader = (source as ReadableStream<Uint8Array>).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        if (value) yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }
  for await (const chunk of source as AsyncIterable<Uint8Array>) yield chunk;
}

/** The archive as an async sequence of byte chunks. */
export async function* zipChunks(
  entries: Iterable<ZipEntrySource> | AsyncIterable<ZipEntrySource>,
  options: ZipWriterOptions = {},
): AsyncGenerator<Uint8Array> {
  const maxBytes = Math.min(options.maxBytes ?? MAX_U32, MAX_U32);
  const records: CentralRecord[] = [];
  let offset = 0;
  let stored = 0;

  for await (const entry of entries) {
    const source = await entry.open();
    if (!source) {
      options.onSkip?.(entry.name);
      continue;
    }
    if (records.length >= MAX_ENTRIES) throw new Error('zip_too_many_entries');

    const name = encoder.encode(entry.name);
    const stamp = dosDateTime(entry.modified ?? new Date());
    const header = localHeader(name, stamp);
    const entryOffset = offset;
    yield header;
    offset += header.length;

    let crc = CRC32_START;
    let size = 0;
    for await (const chunk of chunksOf(source)) {
      if (chunk.length === 0) continue;
      size += chunk.length;
      stored += chunk.length;
      if (stored > maxBytes || offset + chunk.length > MAX_U32) throw new Error('zip_too_large');
      crc = crc32Update(crc, chunk);
      yield chunk;
      offset += chunk.length;
    }

    const finalCrc = crc32Final(crc);
    const descriptor = dataDescriptor(finalCrc, size);
    yield descriptor;
    offset += descriptor.length;
    records.push({ name, stamp, crc: finalCrc, size, offset: entryOffset });
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const record of records) {
    const central = centralHeader(record);
    centralSize += central.length;
    yield central;
  }
  if (centralStart + centralSize > MAX_U32) throw new Error('zip_too_large');
  yield endOfCentralDirectory(records.length, centralSize, centralStart);
}

/** The archive as a web stream, for a `Response` body. */
export function createZipStream(
  entries: Iterable<ZipEntrySource> | AsyncIterable<ZipEntrySource>,
  options: ZipWriterOptions = {},
): ReadableStream<Uint8Array> {
  const iterator = zipChunks(entries, options);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await iterator.return(undefined);
    },
  });
}

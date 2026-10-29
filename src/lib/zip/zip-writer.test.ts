import { describe, expect, it } from 'vitest';
import { crc32, crc32Final, crc32Update, CRC32_START } from '@/lib/zip/crc32';
import { createZipStream, zipChunks, type ZipEntrySource } from '@/lib/zip/zip-writer';
import { cleanZipSegment, createUniqueNamer, zipArchiveName, zipEntryPath } from '@/lib/zip/entry-names';

const enc = new TextEncoder();
const dec = new TextDecoder();

async function collect(entries: ZipEntrySource[], options?: Parameters<typeof zipChunks>[1]) {
  const parts: Uint8Array[] = [];
  for await (const chunk of zipChunks(entries, options)) parts.push(chunk);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A tiny reader that walks the central directory, as unzip tools do, and checks each entry. */
function readZip(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true);
  const cdSize = v.getUint32(eocd + 12, true);
  const cdOffset = v.getUint32(eocd + 16, true);
  expect(cdOffset + cdSize).toBe(eocd);

  const files: Array<{ name: string; data: Uint8Array; crc: number }> = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const flags = v.getUint16(p + 8, true);
    expect(flags & 0x0808).toBe(0x0808);
    expect(v.getUint16(p + 10, true)).toBe(0); // stored
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 20, true);
    expect(v.getUint32(p + 24, true)).toBe(size);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const localNameLen = v.getUint16(local + 26, true);
    expect(dec.decode(bytes.subarray(local + 30, local + 30 + localNameLen))).toBe(name);
    const dataStart = local + 30 + localNameLen;
    const data = bytes.subarray(dataStart, dataStart + size);
    const desc = dataStart + size;
    expect(v.getUint32(desc, true)).toBe(0x08074b50);
    expect(v.getUint32(desc + 4, true)).toBe(crc);
    expect(v.getUint32(desc + 8, true)).toBe(size);
    expect(crc32(data)).toBe(crc);

    files.push({ name, data, crc });
    p += 46 + nameLen;
  }
  return files;
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('gives the same value when fed in chunks', () => {
    const data = enc.encode('The quick brown fox jumps over the lazy dog');
    let running = CRC32_START;
    running = crc32Update(running, data.subarray(0, 10));
    running = crc32Update(running, data.subarray(10));
    expect(crc32Final(running)).toBe(crc32(data));
    expect(crc32(data)).toBe(0x414fa339);
  });
});

describe('zip writer', () => {
  it('writes an archive whose central directory, headers and CRCs agree', async () => {
    const bytes = await collect([
      { name: 'a.txt', open: () => [enc.encode('hello '), enc.encode('world')] },
      {
        name: 'Folder/b.pdf',
        open: () =>
          new ReadableStream<Uint8Array>({
            start(c) {
              c.enqueue(enc.encode('%PDF-1.4'));
              c.close();
            },
          }),
      },
      { name: 'empty.txt', open: () => [] },
    ]);
    const files = readZip(bytes);
    expect(files.map((f) => f.name)).toEqual(['a.txt', 'Folder/b.pdf', 'empty.txt']);
    expect(dec.decode(files[0].data)).toBe('hello world');
    expect(dec.decode(files[1].data)).toBe('%PDF-1.4');
    expect(files[2].data.length).toBe(0);
  });

  it('keeps UTF-8 names', async () => {
    const files = readZip(await collect([{ name: 'प्रमाणपत्र.pdf', open: () => [enc.encode('x')] }]));
    expect(files[0].name).toBe('प्रमाणपत्र.pdf');
  });

  it('skips an entry whose source is missing and reports it', async () => {
    const skipped: string[] = [];
    const files = readZip(
      await collect(
        [
          { name: 'gone.pdf', open: async () => null },
          { name: 'kept.pdf', open: () => [enc.encode('k')] },
        ],
        { onSkip: (n) => skipped.push(n) },
      ),
    );
    expect(skipped).toEqual(['gone.pdf']);
    expect(files.map((f) => f.name)).toEqual(['kept.pdf']);
  });

  it('writes a valid empty archive', async () => {
    const bytes = await collect([]);
    expect(bytes.length).toBe(22);
    expect(readZip(bytes)).toEqual([]);
  });

  it('stops when the stored bytes pass the cap', async () => {
    await expect(
      collect([{ name: 'big.bin', open: () => [new Uint8Array(8), new Uint8Array(8)] }], { maxBytes: 10 }),
    ).rejects.toThrow('zip_too_large');
  });

  it('streams through a web ReadableStream', async () => {
    const stream = createZipStream([{ name: 'a.txt', open: () => [enc.encode('abc')] }]);
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    expect(dec.decode(readZip(buf)[0].data)).toBe('abc');
  });
});

describe('zip entry names', () => {
  it('strips separators, control characters and dot segments', () => {
    expect(cleanZipSegment('../etc')).toBe('.._etc');
    expect(cleanZipSegment('..')).toBe('');
    expect(cleanZipSegment('a\\b:c*?')).toBe('a_b_c_');
    expect(zipEntryPath('../../Pre-incorporation/./Step 1', '/tmp/x/../PAN.pdf')).toBe(
      'Pre-incorporation/Step 1/PAN.pdf',
    );
    expect(zipEntryPath(null, '')).toBe('file');
  });

  it('numbers repeated paths before the extension', () => {
    const unique = createUniqueNamer();
    expect(unique('a/b.pdf')).toBe('a/b.pdf');
    expect(unique('a/B.pdf')).toBe('a/B (2).pdf');
    expect(unique('a/b.pdf')).toBe('a/b (3).pdf');
    expect(unique('noext')).toBe('noext');
    expect(unique('noext')).toBe('noext (2)');
  });

  it('names the archive', () => {
    expect(zipArchiveName('Acme Pvt Ltd')).toBe('Acme Pvt Ltd.zip');
    expect(zipArchiveName('x.zip')).toBe('x.zip');
    expect(zipArchiveName('')).toBe('documents.zip');
  });
});

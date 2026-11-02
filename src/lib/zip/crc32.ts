/**
 * CRC-32 (the IEEE 802.3 polynomial, reflected, 0xEDB88320) as the ZIP format uses it.
 * Feed chunks in order with `crc32Update`, starting from `CRC32_START`, and finish with
 * `crc32Final`; `crc32` does all three for one buffer.
 */

const TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** The running value before the first byte. */
export const CRC32_START = 0xffffffff;

/** Fold one chunk into a running CRC value (not yet finalised). */
export function crc32Update(running: number, chunk: Uint8Array): number {
  let c = running >>> 0;
  for (let i = 0; i < chunk.length; i++) {
    c = TABLE[(c ^ chunk[i]) & 0xff] ^ (c >>> 8);
  }
  return c >>> 0;
}

/** Turn a running value into the CRC that goes into the archive. */
export function crc32Final(running: number): number {
  return (running ^ 0xffffffff) >>> 0;
}

/** CRC-32 of one buffer. */
export function crc32(data: Uint8Array): number {
  return crc32Final(crc32Update(CRC32_START, data));
}

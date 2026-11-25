/** A DIN is exactly eight digits. */
export const DIN_REGEX = /^[0-9]{8}$/;

export function isValidDin(input: string): boolean {
  return DIN_REGEX.test(input.trim());
}

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;

export function isValidGstin(input: string): boolean {
  return GSTIN_REGEX.test(input.trim().toUpperCase());
}

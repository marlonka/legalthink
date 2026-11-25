// Same rule as the backend's quote check: NFC, whitespace collapsed, at least 12 characters.
export const MIN_QUOTE_LENGTH = 12;

export function normalizeQuote(value: string) {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

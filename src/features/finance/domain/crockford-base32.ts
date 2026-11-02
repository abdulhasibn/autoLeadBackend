/**
 * Crockford base32: no I, L, O or U, so keys read aloud or retyped by hand are
 * hard to get wrong. Used only to render random key bytes as text.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const LOOKALIKES: Readonly<Record<string, string>> = { O: '0', I: '1', L: '1' };

export function encodeCrockfordBase32(bytes: Uint8Array): string {
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET.charAt((buffer >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET.charAt((buffer << (5 - bits)) & 31);
  }
  return output;
}

/**
 * Upper-cases, drops spaces and dashes, and maps the look-alike letters O, I
 * and L to their digits. Returns null when a character is outside the alphabet.
 */
export function normalizeCrockfordBase32(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, '');
  let output = '';
  for (const char of compact) {
    const mapped = LOOKALIKES[char] ?? char;
    if (!ALPHABET.includes(mapped)) {
      return null;
    }
    output += mapped;
  }
  return output;
}

export function groupInFours(value: string): string {
  return value.match(/.{1,4}/g)?.join('-') ?? value;
}

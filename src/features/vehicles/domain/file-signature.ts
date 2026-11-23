/** How many leading bytes are enough to recognise every supported format. */
export const SIGNATURE_BYTES = 16;

export type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

const startsWith = (bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean =>
  bytes.length >= offset + prefix.length && prefix.every((b, i) => bytes[offset + i] === b);

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/**
 * The real type of a file, read from its magic bytes (not its name or the
 * Content-Type the uploader claimed). Null when it is none of JPEG, PNG,
 * WebP or PDF.
 */
export function sniffFileType(bytes: Uint8Array): SniffedType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) return 'image/webp';
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf';
  return null;
}

export const MEDIA_SIGNATURES: readonly SniffedType[] = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_SIGNATURES: readonly SniffedType[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

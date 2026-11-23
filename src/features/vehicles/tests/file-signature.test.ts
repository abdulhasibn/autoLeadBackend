import { describe, expect, it } from 'vitest';

import { sniffFileType } from '../domain/file-signature';

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

describe('sniffFileType', () => {
  it('recognises JPEG, PNG, WebP and PDF', () => {
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0))).toBe('image/jpeg');
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      'image/png',
    );
    expect(sniffFileType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP')))).toBe('image/webp');
    expect(sniffFileType(bytes(...ascii('%PDF-1.7')))).toBe('application/pdf');
  });

  it('rejects text, GIF, HTML and an empty file', () => {
    expect(sniffFileType(bytes(...ascii('this is not an image')))).toBeNull();
    expect(sniffFileType(bytes(...ascii('GIF89a')))).toBeNull();
    expect(sniffFileType(bytes(...ascii('<html><script>')))).toBeNull();
    expect(sniffFileType(bytes())).toBeNull();
  });

  it('rejects truncated and look-alike headers', () => {
    expect(sniffFileType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(sniffFileType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE')))).toBeNull();
    expect(sniffFileType(bytes(...ascii('%PDF')))).toBeNull();
  });
});

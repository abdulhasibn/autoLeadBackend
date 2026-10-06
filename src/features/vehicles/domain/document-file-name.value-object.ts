const MAX_LENGTH = 255;

/**
 * The uploader's original file name, kept for display only. Any directory
 * part a client sends (`C:\scans\rc.pdf`, `../rc.pdf`) is dropped, so the
 * value can never be mistaken for a storage path.
 */
export class DocumentFileName {
  private constructor(readonly value: string) {}

  static create(input: string): DocumentFileName {
    const baseName = input.split(/[\\/]/).pop() ?? '';
    const normalized = baseName.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (normalized.length === 0 || normalized === '.' || normalized === '..') {
      throw new Error('File name cannot be empty');
    }
    if (normalized.length > MAX_LENGTH) {
      throw new Error(`File name must be at most ${MAX_LENGTH} characters`);
    }
    return new DocumentFileName(normalized);
  }
}

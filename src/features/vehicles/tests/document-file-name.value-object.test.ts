import { describe, expect, it } from 'vitest';

import { DocumentFileName } from '../domain/document-file-name.value-object';

describe('DocumentFileName', () => {
  it('keeps a plain file name', () => {
    expect(DocumentFileName.create('RC_Document.pdf').value).toBe('RC_Document.pdf');
  });

  it('drops any directory part', () => {
    expect(DocumentFileName.create('C:\\scans\\rc.pdf').value).toBe('rc.pdf');
    expect(DocumentFileName.create('../../etc/rc.pdf').value).toBe('rc.pdf');
  });

  it('trims whitespace and strips control characters', () => {
    expect(DocumentFileName.create('  insur\u0000ance.pdf \n').value).toBe('insurance.pdf');
  });

  it('rejects names that are empty after normalising', () => {
    expect(() => DocumentFileName.create('   ')).toThrow('File name cannot be empty');
    expect(() => DocumentFileName.create('scans/')).toThrow('File name cannot be empty');
    expect(() => DocumentFileName.create('..')).toThrow('File name cannot be empty');
  });

  it('rejects names longer than 255 characters', () => {
    expect(() => DocumentFileName.create(`${'a'.repeat(252)}.pdf`)).toThrow('at most 255');
  });
});

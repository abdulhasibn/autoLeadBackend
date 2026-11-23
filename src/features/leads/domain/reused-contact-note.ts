/**
 * The note added to a lead when staff typed a different name for a phone that
 * already belongs to a contact. The contact keeps its name; the typed one is
 * kept here so nothing is lost.
 */
export function withReusedContactNote(
  notes: string | null,
  typedName: string,
  contactName: string,
): string {
  const line = `Entered as "${typedName.trim()}"; contact on file: "${contactName}".`;
  return notes === null || notes.trim() === '' ? line : `${notes.trimEnd()}\n${line}`;
}

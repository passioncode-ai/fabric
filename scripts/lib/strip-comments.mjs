// Comments, blanked, with the line numbering intact.
//
// ONE HOME (R-005, UXA-C02). This lived inside `check-control-names.mjs`, and
// `check-ipc-contract.mjs` scanned raw source without it — so a doc comment
// that QUOTED the shape a gate refuses was read as the shape itself. Measured
// on 2026-09-11: the sentence "this channel used to be
// `handle(IPC.attentionList, readAttention)`" made that gate report a
// by-name handler that no longer existed, and count eighty-nine handlers where
// the file has eighty-eight. A gate that reads its own explanation as evidence
// is a gate nobody can write an explanation near.
//
// A block comment becomes the newlines it spanned and a line comment becomes an
// empty line, so `slice(0, index).split('\n').length` still names the real line.

export function stripComments(text) {
  const noBlocks = text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
  return noBlocks
    .split('\n')
    .map((l) => (l.trim().startsWith('//') ? '' : l))
    .join('\n')
}

import { commitment, nullifierHash, type Note } from '../lib/protocol';
// This checks a demo witness; it does NOT generate a zero-knowledge proof.
self.onmessage = (event: MessageEvent<Note>) => {
  try {
    const note = event.data;
    if (commitment(note) !== note.commitment) throw new Error('Commitment mismatch.');
    self.postMessage({ ok: true, nullifierHash: nullifierHash(note) });
  } catch { self.postMessage({ ok: false, error: 'Local note integrity check failed.' }); }
};

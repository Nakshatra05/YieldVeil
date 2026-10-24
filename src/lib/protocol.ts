import { poseidon1 } from 'poseidon-lite/poseidon1';
import { poseidon2 } from 'poseidon-lite/poseidon2';
import { poseidon3 } from 'poseidon-lite/poseidon3';

export const UNIT = 10n ** 18n;
export const DEMO_RATE = 1_200_000_000_000_000_000n;
export const DEMO_FEE = 500_000_000_000_000n;
export const DEMO_DEPOSITOR = '0x1111111111111111111111111111111111111111';
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export type Note = { id: string; value: string; principal: string; label: string; nullifier: string; secret: string; commitment: string; createdAt: number; depositor: string; status: 'approved' | 'pending' | 'rejected' | 'spent' };
export type Activity = { id: string; type: 'deposit' | 'withdraw' | 'ragequit'; value: string; timestamp: number; recipient?: string; fee?: string };
export type Vault = { version: 1; notes: Note[]; activity: Activity[]; spent: string[] };
export const emptyVault = (): Vault => ({ version: 1, notes: [], activity: [], spent: [] });
export function parseAmount(input: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(input)) throw new Error('Enter a positive amount with up to 18 decimal places.');
  const [whole, fraction = ''] = input.split('.');
  const n = BigInt(whole) * UNIT + BigInt(fraction.padEnd(18, '0'));
  if (n <= 0n || n > 100n * UNIT) throw new Error('Use an amount greater than 0 and at most 100.');
  return n;
}
export function formatAmount(value: bigint, places = 4): string {
  const scale = 10n ** BigInt(18 - places);
  const rounded = ((value + scale / 2n) / scale) * scale;
  return `${rounded / UNIT}.${(rounded % UNIT).toString().padStart(18, '0').slice(0, places)}`;
}
export function exactAmount(value: bigint): string {
  return `${value / UNIT}.${(value % UNIT).toString().padStart(18, '0')}`;
}
export function randomField(): string {
  // Rejection sampling avoids modulo bias.
  let n: bigint;
  do { n = BigInt('0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)), v => v.toString(16).padStart(2, '0')).join('')); } while (n >= FIELD);
  return n.toString();
}
export function commitment(note: Pick<Note, 'value' | 'label' | 'nullifier' | 'secret'>): string {
  return poseidon3([BigInt(note.value), BigInt(note.label), poseidon2([BigInt(note.nullifier), BigInt(note.secret)])]).toString();
}
export function nullifierHash(note: Note): string { return poseidon1([BigInt(note.nullifier)]).toString(); }
export function createNote(value: bigint, principal: bigint, depositor = DEMO_DEPOSITOR, label = randomField(), createdAt = Date.now()): Note {
  const fields = { value: value.toString(), label, nullifier: randomField(), secret: randomField() };
  return { ...fields, id: crypto.randomUUID(), principal: principal.toString(), commitment: commitment(fields), createdAt, depositor, status: 'approved' };
}
export function deposit(vault: Vault, amount: bigint, asset: 'ETH' | 'wstETH'): Vault {
  if (amount <= 0n || amount > 100n * UNIT) throw new Error('Deposit must be between 0 and 100.');
  const shares = asset === 'ETH' ? amount * UNIT / DEMO_RATE : amount;
  if (shares === 0n) throw new Error('Amount is too small to create a share.');
  const principal = asset === 'ETH' ? amount : amount * DEMO_RATE / UNIT;
  const note = createNote(shares, principal);
  return { ...vault, notes: [...vault.notes, note], activity: [{ id: crypto.randomUUID(), type: 'deposit', value: shares.toString(), timestamp: Date.now() }, ...vault.activity] };
}
export function validateRecipient(recipient: string, depositor: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(recipient) || /^0x0{40}$/i.test(recipient)) throw new Error('Enter a valid, non-zero Ethereum address.');
  if (recipient.toLowerCase() === depositor.toLowerCase()) throw new Error('Use a fresh address, different from the deposit address.');
}
export function withdraw(vault: Vault, id: string, amount: bigint, recipient: string, ragequit = false): Vault {
  const note = vault.notes.find(n => n.id === id);
  if (!note || note.status === 'spent' || vault.spent.includes(nullifierHash(note))) throw new Error('This note has already been spent or is unavailable.');
  if (commitment(note) !== note.commitment) throw new Error('Note integrity check failed.');
  if (!ragequit && note.status !== 'approved') throw new Error('This note is not in the approved association set.');
  const fee = ragequit ? 0n : DEMO_FEE;
  if (!ragequit) validateRecipient(recipient, note.depositor);
  if (amount <= fee || amount > BigInt(note.value)) throw new Error('Amount must exceed the fee and fit within the selected note.');
  if (ragequit && (amount !== BigInt(note.value) || recipient.toLowerCase() !== note.depositor.toLowerCase())) throw new Error('Public exit returns the entire note to its original depositor.');
  const remaining = BigInt(note.value) - amount;
  const notes = vault.notes.map(n => n.id === id ? { ...n, status: 'spent' as const } : n);
  if (remaining > 0n) notes.push(createNote(remaining, BigInt(note.principal) * remaining / BigInt(note.value), note.depositor, note.label, note.createdAt));
  return { version: 1, notes, spent: [...vault.spent, nullifierHash(note)], activity: [{ id: crypto.randomUUID(), type: ragequit ? 'ragequit' : 'withdraw', value: (amount - fee).toString(), timestamp: Date.now(), recipient, fee: fee.toString() }, ...vault.activity] };
}
export function projection(principal: number, apr: number, days: number): number { return principal * (1 + apr / 100 * days / 365); }

export function validateVault(data: unknown): asserts data is Vault {
  if (!data || typeof data !== 'object') throw new Error('Invalid vault file.');
  const v = data as Vault;
  if (v.version !== 1 || !Array.isArray(v.notes) || !Array.isArray(v.activity) || !Array.isArray(v.spent) || v.notes.length > 10000 || v.activity.length > 20000) throw new Error('Unsupported vault format.');
  const ids = new Set<string>();
  const hashes = new Set<string>();
  for (const n of v.notes) {
    if (!n || typeof n.id !== 'string' || ids.has(n.id) || !['approved', 'pending', 'rejected', 'spent'].includes(n.status) || !Number.isFinite(n.createdAt) || !/^0x[0-9a-fA-F]{40}$/.test(n.depositor)) throw new Error('Invalid note.');
    for (const key of ['value', 'principal', 'label', 'secret', 'nullifier', 'commitment'] as const) {
      if (typeof n[key] !== 'string' || !/^\d{1,78}$/.test(n[key]) || BigInt(n[key]) >= FIELD) throw new Error('Invalid note field.');
    }
    if (BigInt(n.value) <= 0n || BigInt(n.value) > 100n * UNIT || commitment(n) !== n.commitment || hashes.has(nullifierHash(n))) throw new Error('Corrupt or duplicate note.');
    ids.add(n.id); hashes.add(nullifierHash(n));
  }
  if (v.spent.some(h => typeof h !== 'string' || !/^\d{1,78}$/.test(h)) || new Set(v.spent).size !== v.spent.length) throw new Error('Invalid spent set.');
  for (const n of v.notes) if ((n.status === 'spent') !== v.spent.includes(nullifierHash(n))) throw new Error('Inconsistent spent state.');
  for (const a of v.activity) if (!a || typeof a.id !== 'string' || !['deposit', 'withdraw', 'ragequit'].includes(a.type) || typeof a.value !== 'string' || !/^\d{1,78}$/.test(a.value) || !Number.isFinite(a.timestamp) || (a.recipient !== undefined && !/^0x[0-9a-fA-F]{40}$/.test(a.recipient))) throw new Error('Invalid activity.');
}

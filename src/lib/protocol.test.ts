import { describe, expect, it } from 'vitest';
import { commitment, DEMO_DEPOSITOR, DEMO_FEE, DEMO_RATE, UNIT, deposit, emptyVault, exactAmount, nullifierHash, parseAmount, projection, validateRecipient, validateVault, withdraw } from './protocol';
import { decryptVault, encryptVault } from './vault';
import { getAquaRoute } from './aqua';
const recipient = '0x2222222222222222222222222222222222222222';
describe('integer accounting', () => {
  it('preserves every wei without floating point', () => {
    expect(parseAmount('1.000000000000000001')).toBe(UNIT + 1n);
    expect(parseAmount(exactAmount(UNIT + 123n))).toBe(UNIT + 123n);
  });
  it.each(['0', '-1', 'Infinity', 'NaN', '1e18', '0x1', '01', '.5', '100.01', '1.0000000000000000001', ''])('rejects invalid amount %s', amount => expect(() => parseAmount(amount)).toThrow());
  it('credits only rounded-down shares, not an expected full ETH amount', () => {
    const vault = deposit(emptyVault(), UNIT, 'ETH');
    expect(BigInt(vault.notes[0].value)).toBe(UNIT * UNIT / DEMO_RATE);
    expect(BigInt(vault.notes[0].value) * DEMO_RATE / UNIT).toBeLessThanOrEqual(UNIT);
    expect(() => deposit(emptyVault(), 1n, 'ETH')).toThrow('too small');
  });
  it('keeps wstETH deposits one-to-one in shares', () => {
    const vault = deposit(emptyVault(), UNIT, 'wstETH');
    expect(vault.notes[0].value).toBe(UNIT.toString());
    expect(() => validateVault(vault)).not.toThrow();
  });
});
describe('demo note lifecycle', () => {
  it('preserves value as payout + fee + change, with fresh secrets and stable label', () => {
    const start = deposit(emptyVault(), UNIT, 'wstETH');
    const original = start.notes[0];
    const next = withdraw(start, original.id, UNIT / 2n, recipient);
    const change = next.notes.find(n => n.status !== 'spent')!;
    expect(BigInt(next.activity[0].value) + BigInt(next.activity[0].fee!) + BigInt(change.value)).toBe(UNIT);
    expect(change.label).toBe(original.label);
    expect(change.nullifier).not.toBe(original.nullifier);
    expect(change.secret).not.toBe(original.secret);
    expect(change.commitment).toBe(commitment(change));
    expect(next.spent).toContain(nullifierHash(original));
    expect(() => validateVault(next)).not.toThrow();
  });
  it('rejects repeated spending', () => {
    const start = deposit(emptyVault(), UNIT, 'wstETH');
    const next = withdraw(start, start.notes[0].id, UNIT / 2n, recipient);
    expect(() => withdraw(next, start.notes[0].id, UNIT / 2n, recipient)).toThrow('spent');
  });
  it('creates no zero-value change on a full spend', () => {
    const v = deposit(emptyVault(), UNIT, 'wstETH');
    const next = withdraw(v, v.notes[0].id, UNIT, recipient);
    expect(next.notes).toHaveLength(1);
    expect(next.notes[0].status).toBe('spent');
    expect(next.activity[0].value).toBe((UNIT - DEMO_FEE).toString());
  });
  it('rejects overspending and amounts not covering the fee', () => {
    const v = deposit(emptyVault(), UNIT, 'wstETH');
    expect(() => withdraw(v, v.notes[0].id, UNIT + 1n, recipient)).toThrow();
    expect(() => withdraw(v, v.notes[0].id, DEMO_FEE, recipient)).toThrow();
  });
  it('requires approval privately but permits public full exit for rejected notes', () => {
    const v = deposit(emptyVault(), UNIT, 'wstETH'); v.notes[0].status = 'rejected';
    expect(() => withdraw(v, v.notes[0].id, UNIT, recipient)).toThrow('approved');
    expect(() => withdraw(v, v.notes[0].id, UNIT, recipient, true)).toThrow('original');
    const next = withdraw(v, v.notes[0].id, UNIT, DEMO_DEPOSITOR, true);
    expect(next.activity[0].fee).toBe('0');
    expect(next.activity[0].type).toBe('ragequit');
  });
  it('blocks the original depositor and invalid recipient addresses', () => {
    expect(() => validateRecipient(DEMO_DEPOSITOR, DEMO_DEPOSITOR)).toThrow('fresh');
    expect(() => validateRecipient('0x' + '0'.repeat(40), DEMO_DEPOSITOR)).toThrow();
    expect(() => validateRecipient('0x1234', DEMO_DEPOSITOR)).toThrow();
  });
  it('rejects note corruption, duplicates and inconsistent spent sets', () => {
    const v = deposit(emptyVault(), UNIT, 'wstETH');
    const corrupt = structuredClone(v); corrupt.notes[0].value = '12';
    expect(() => validateVault(corrupt)).toThrow();
    expect(() => validateVault({ ...v, notes: [...v.notes, ...v.notes] })).toThrow();
    expect(() => validateVault({ ...v, spent: [nullifierHash(v.notes[0])] })).toThrow();
  });
});
describe('encrypted vault', () => {
  it('round-trips notes without plaintext secrets and randomizes ciphertext', async () => {
    const v = deposit(emptyVault(), UNIT, 'ETH');
    const [a,b] = await Promise.all([encryptVault(v, 'testing-only-passphrase'), encryptVault(v, 'testing-only-passphrase')]);
    expect(a).not.toBe(b); expect(a).not.toContain(v.notes[0].secret);
    expect(await decryptVault(a, 'testing-only-passphrase')).toEqual(v);
  });
  it('fails closed for wrong passphrases and modified ciphertext', async () => {
    const encrypted = await encryptVault(emptyVault(), 'testing-only-passphrase');
    await expect(decryptVault(encrypted, 'incorrect-passphrase')).rejects.toThrow('Could not unlock');
    const e = JSON.parse(encrypted); e.ciphertext = (e.ciphertext[0] === 'A' ? 'B' : 'A') + e.ciphertext.slice(1);
    await expect(decryptVault(JSON.stringify(e), 'testing-only-passphrase')).rejects.toThrow();
    await expect(encryptVault(emptyVault(), 'short')).rejects.toThrow('12');
  });
});
describe('honest projections and adapters', () => {
  it('uses simple APR, including zero yield', () => {
    expect(projection(1, 3, 365)).toBe(1.03);
    expect(projection(1, 0, 365)).toBe(1);
    expect(projection(2, 3, 0)).toBe(2);
  });
  it('never invents an available AQUA0 route', () => {
    for (const chain of ['ethereum','base','arbitrum'] as const) expect(getAquaRoute(chain).supported).toBe(false);
  });
});

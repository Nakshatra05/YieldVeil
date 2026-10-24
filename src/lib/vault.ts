import { validateVault, type Vault } from './protocol';
export const STORAGE_KEY = 'yieldveil.encrypted-demo-v1';
const ITERATIONS = 310000;
type Envelope = { format: 'yieldveil-demo-v1'; salt: string; iv: string; ciphertext: string };
const encode = (a: Uint8Array) => btoa(Array.from(a, b => String.fromCharCode(b)).join(''));
const decode = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptVault(vault: Vault, password: string): Promise<string> {
  if (password.length < 12) throw new Error('Use a passphrase with at least 12 characters.');
  validateVault(vault);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(vault)));
  return JSON.stringify({ format: 'yieldveil-demo-v1', salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) } satisfies Envelope);
}
export async function decryptVault(text: string, password: string): Promise<Vault> {
  if (text.length > 5_000_000) throw new Error('Backup is too large.');
  try {
    const e = JSON.parse(text) as Envelope;
    if (e.format !== 'yieldveil-demo-v1' || typeof e.salt !== 'string' || typeof e.iv !== 'string' || typeof e.ciphertext !== 'string') throw new Error();
    const salt = decode(e.salt), iv = decode(e.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error();
    const key = await derive(password, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, decode(e.ciphertext));
    const vault: unknown = JSON.parse(new TextDecoder().decode(plain));
    validateVault(vault);
    return vault;
  } catch { throw new Error('Could not unlock this backup. Check the passphrase and file.'); }
}
export function downloadBackup(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `yieldveil-demo-backup-${new Date().toISOString().slice(0,10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

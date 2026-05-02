/**
 * Per-note AES-GCM encryption using WebCrypto.
 * Password → PBKDF2 (210k iter, SHA-256) → 256-bit AES-GCM key.
 *
 * The encrypted Note's `content` field stores a JSON envelope:
 *   { v: 1, salt: <base64>, iv: <base64>, ct: <base64> }
 * `text` is also stored as encrypted base64 (or empty if you want to hide it).
 *
 * Lose the password = lose the data. There is no recovery.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const raw = atob(s);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const pwdBytes = enc.encode(password);
  const baseKey = await crypto.subtle.importKey(
    'raw', pwdBytes.buffer.slice(pwdBytes.byteOffset, pwdBytes.byteOffset + pwdBytes.byteLength) as ArrayBuffer,
    'PBKDF2', false, ['deriveKey'],
  );
  const saltBuf = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: 210_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function asBuf(u: Uint8Array): ArrayBuffer {
  return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;
}

export type Envelope = {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
};

export function isEnvelope(s: string): boolean {
  try {
    const o = JSON.parse(s);
    return o && o.v === 1 && typeof o.salt === 'string' && typeof o.iv === 'string' && typeof o.ct === 'string';
  } catch { return false; }
}

export async function encryptString(plain: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plainBytes = enc.encode(plain);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBuf(iv) }, key, asBuf(plainBytes));
  const env: Envelope = { v: 1, salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(ct) };
  return JSON.stringify(env);
}

export async function decryptString(envelopeJson: string, password: string): Promise<string> {
  const env = JSON.parse(envelopeJson) as Envelope;
  if (env.v !== 1) throw new Error('Unsupported envelope version');
  const salt = b64decode(env.salt);
  const iv = b64decode(env.iv);
  const ct = b64decode(env.ct);
  const key = await deriveKey(password, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asBuf(iv) }, key, asBuf(ct));
  return dec.decode(plain);
}

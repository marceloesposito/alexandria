// Conversioni di byte, condivise da piattaforma, import ed export.

export function bytesToBase64(data: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    s += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function utf8(data: Uint8Array): string {
  return new TextDecoder('utf-8').decode(data);
}

export function toUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function dataUrl(data: Uint8Array, mime: string): string {
  return `data:${mime};base64,${bytesToBase64(data)}`;
}

import { scryptSync } from 'node:crypto';
// Return a string: Pyodide cannot wrap Node Buffer instances directly.
export function derivePassword(password, salt) {
  return scryptSync(password, salt, 32, {N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024}).toString('hex');
}

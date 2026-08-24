import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Filesystem / {{var}} syntax primitives shared by the planning, mutation, and
// remove modules.

export const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
export const has = (root: string, rel: string) => existsSync(join(root, rel));
export const VAR_REF = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;
export const destOf = (line: string) => (line.includes('->') ? line.split('->')[1].trim() : line.trim());
export const srcOf = (line: string) => (line.includes('->') ? line.split('->')[0].trim() : line.trim());

export function fileHasLine(root: string, rel: string, line: string): boolean {
  return read(join(root, rel))
    .split('\n')
    .some((l) => l.trim() === line.trim());
}
export function pkgHasDep(root: string, name: string): boolean {
  try {
    const pkg = JSON.parse(read(join(root, 'package.json')) || '{}');
    return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
  } catch {
    return false;
  }
}
export function envKeySet(root: string, key: string): boolean {
  return read(join(root, '.env'))
    .split('\n')
    .some((l) => {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
      return m !== null && m[1] === key && m[2].trim().length > 0;
    });
}
// Does the array-of-objects JSON at `rel` already contain an element whose
// [key] equals `value`? The idempotency probe for json-merge.
export function jsonArrayHasKey(root: string, rel: string, key: string, value: unknown): boolean {
  try {
    const arr = JSON.parse(read(join(root, rel)) || '[]');
    return (
      Array.isArray(arr) &&
      arr.some((el) => el !== null && typeof el === 'object' && (el as Record<string, unknown>)[key] === value)
    );
  } catch {
    return false;
  }
}

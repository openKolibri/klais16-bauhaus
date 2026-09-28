// Resolve Playwright from the project, or from a global install.
import { createRequire } from 'node:module';

export function loadPlaywright() {
  const bases = [import.meta.url, 'file:///opt/node22/lib/node_modules/', 'file:///usr/local/lib/node_modules/', 'file:///usr/lib/node_modules/'];
  for (const base of bases) {
    try { return createRequire(base)('playwright'); } catch { /* try the next location */ }
  }
  throw new Error('Playwright not found - run `npm install` (or `npm i -g playwright`).');
}

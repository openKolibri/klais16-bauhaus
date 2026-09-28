// Parses firmware/include/sixteenSegments.h (MIT, (c) 2017 David Madison - github.com/dmadison/LED-Segment-ASCII)
// into a JSON table so the video draws exactly the glyphs the display firmware draws.
// usage: node tools/extract-font.mjs /path/to/klais-16 > src/geometry/font16.json
import { readFileSync } from 'node:fs';
const root = process.argv[2] || '/home/user/openkolibri/klais-16';
const src = readFileSync(`${root}/firmware/include/sixteenSegments.h`, 'utf8');
const defs = {};
for (const m of src.matchAll(/#define\s+_(\w+)\s+(0x[0-9A-Fa-f]+)/g)) defs[m[1]] = Number.parseInt(m[2], 16);
const body = src.slice(src.indexOf('SixteenSegmentASCII[96] = {') + 'SixteenSegmentASCII[96] = {'.length, src.indexOf('};', src.indexOf('SixteenSegmentASCII[96]')))
  .replace(/\/\*.*?\*\//g, '');
const entries = body.split(',').map((s) => s.trim()).filter((s) => s.length);
if (entries.length !== 96) throw new Error(`expected 96 glyphs, got ${entries.length}`);
const table = entries.map((e) => e.split('|').map((s) => s.trim().replace(/^_/, '')).reduce((v, tok) => v | (tok === '0' ? 0 : defs[tok] ?? (() => { throw new Error('unknown token ' + tok); })()), 0));
const check = (ch, expectTokens) => {
  const want = expectTokens.reduce((v, k) => v | defs[k], 0), got = table[ch.charCodeAt(0) - 32];
  if (want !== got) throw new Error(`glyph ${ch}: expected ${want.toString(16)} got ${got.toString(16)}`);
};
check('0', ['T', 'N', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A']); // slashed zero
check('K', ['U', 'R', 'N', 'H', 'G']);
check(' ', []);
process.stdout.write(JSON.stringify({
  _about: 'Sixteen-segment ASCII 0x20..0x7F. Bit 0 = segment A ... bit 15 = U, bit 16 = DP (segment order ABCDEFGHKMNPRSTU).',
  _license: 'Sixteen Segment ASCII table: MIT License, Copyright (c) 2017 David Madison (github.com/dmadison/LED-Segment-ASCII), as shipped in openKolibri/klais-16 firmware/include/sixteenSegments.h',
  first: 32,
  table,
}));

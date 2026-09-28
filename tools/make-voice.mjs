// Generates the robot-voice sample library with eSpeak NG (formant synthesis - the classic robotic techno voice).
// The generated WAVs are committed, so building the track does NOT require eSpeak; re-run this only to remake them.
//   apt install espeak-ng && node tools/make-voice.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const OUT = 'src/audio/samples';
const VOICE = process.env.VOICE || 'en-us+m3';
const WORDS = {
  sixteen: 'sixteen', segment: 'segment', display: 'display', klais: 'klais', kolibri: 'kolibri',
  six: 'six', teen: 'teen', seg: 'seg', ment: 'ment', dis: 'dis', play: 'play', klai: 'clay', s: 's',
};

function readWav(file) {
  const b = readFileSync(file), sr = b.readUInt32LE(24);
  let o = 12; while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  const n = b.readUInt32LE(o + 4) / 2, x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(o + 8 + i * 2) / 32768;
  return { sr, x };
}
function writeWav(file, sr, x) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  writeFileSync(file, b);
}

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(path.join(tmpdir(), 'voice-'));
for (const [name, text] of Object.entries(WORDS)) {
  const f = path.join(tmp, name + '.wav');
  const r = spawnSync('espeak-ng', ['-v', VOICE, '-p', '28', '-s', '150', '-a', '200', '-w', f, text]);
  if (r.status !== 0) throw new Error('espeak-ng failed: ' + r.stderr);
  const { sr, x } = readWav(f);
  // trim leading/trailing silence (-42 dB), normalise, add a 4 ms fade
  const thr = Math.pow(10, -42 / 20);
  let a = 0, z = x.length - 1; while (a < z && Math.abs(x[a]) < thr) a++; while (z > a && Math.abs(x[z]) < thr) z--;
  const y = x.slice(Math.max(0, a - 40), Math.min(x.length, z + 200));
  let pk = 0; for (const v of y) pk = Math.max(pk, Math.abs(v));
  const fade = Math.round(sr * 0.004);
  for (let i = 0; i < y.length; i++) { y[i] = (y[i] / pk) * 0.9; if (i < fade) y[i] *= i / fade; if (i > y.length - fade) y[i] *= (y.length - i) / fade; }
  writeWav(path.join(OUT, name + '.wav'), sr, y);
  console.log(`${name.padEnd(9)} ${(y.length / sr).toFixed(2)} s @ ${sr} Hz`);
}
writeFileSync(path.join(OUT, 'README.md'), `# Voice samples\n\nGenerated with [eSpeak NG](https://github.com/espeak-ng/espeak-ng) (voice \`${VOICE}\`, pitch 28, 150 wpm) by \`tools/make-voice.mjs\`.\nThey are the raw material for the vocal chops in the track; they are pitched, crushed and effected in \`src/audio/voices.mjs\`.\nThe texts are the three title words of the klais-16 README (SIXTEEN / SEGMENT / DISPLAY), the product name and their syllables.\n`);

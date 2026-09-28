// Minimal static file server (repo root) used by the capture tools and for local preview.
import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.png': 'image/png', '.css': 'text/css', '.ttf': 'font/ttf' };

export function serve(root, port = 0) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(root, rel === '/' ? '/src/render/index.html' : rel);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    try {
      const st = statSync(file);
      if (!st.isFile()) throw new Error('nf');
      const range = req.headers.range;
      const type = MIME[path.extname(file)] || 'application/octet-stream';
      if (range) {
        const [a, b] = range.replace('bytes=', '').split('-'), start = +a, end = b ? +b : st.size - 1;
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
        createReadStream(file).pipe(res);
      }
    } catch { res.writeHead(404).end('not found'); }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}
if (process.argv[1] && process.argv[1].endsWith('serve.mjs')) {
  const s = await serve(path.resolve(process.argv[2] || '.'), Number(process.argv[3] || 8080));
  console.log(`serving on ${s.url}  (open ${s.url}/src/render/index.html)`);
}

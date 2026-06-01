// Minimal zero-dependency static server.
// ES modules cannot be loaded over file:// (browser CORS blocks the null origin),
// so the game must be served over HTTP. Run with: npm start
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, join } from 'node:path';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT) || 8000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', // required so <script type="module"> loads
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  // Map the URL to a file under ROOT, defaulting to index.html.
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const rel = normalize(urlPath === '/' ? '/index.html' : urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(ROOT, rel);

  // Stay inside ROOT (basic traversal guard).
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`1D Football running at http://localhost:${PORT}`);
});

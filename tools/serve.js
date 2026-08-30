#!/usr/bin/env node
/**
 * A minimal static file server, so `npm start` works with no dependencies.
 *
 * The app is plain ES modules, which browsers refuse to load over file://.
 * Any static server will do; this one just avoids needing one installed.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[3] ?? '.');
const port = Number(process.env.PORT ?? process.argv[2] ?? 8080);

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/markdown',
  '.ico': 'image/x-icon', '.txt': 'text/plain',
};

const server = createServer(async (req, res) => {
  try {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

    // Contain every request within the served root: normalize collapses any
    // "..", and the prefix check rejects anything that still escapes.
    const candidate = resolve(join(root, normalize(requested)));
    if (candidate !== root && !candidate.startsWith(root + '/')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end('403 Forbidden');
      return;
    }

    let filePath = candidate;
    const info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) filePath = join(filePath, 'index.html');

    const body = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    }).end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 Not Found');
  }
});

server.listen(port, () => {
  console.log(`WISC-V calculator running at http://localhost:${port}`);
  console.log('Press Ctrl+C to stop.');
});

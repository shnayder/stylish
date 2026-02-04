import { createServer } from 'http';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const STYLE_GUIDE_PATH = join(__dirname, 'style-guide.json');
const CATEGORY_REGISTRY_PATH = join(__dirname, 'category-registry.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function handleStyleGuideGet(res) {
  try {
    if (existsSync(STYLE_GUIDE_PATH)) {
      const data = await readFile(STYLE_GUIDE_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
  } catch (err) {
    console.error('Error reading style guide:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to read style guide' }));
  }
}

async function handleCategoryRegistryGet(res) {
  try {
    if (existsSync(CATEGORY_REGISTRY_PATH)) {
      const data = await readFile(CATEGORY_REGISTRY_PATH, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    }
  } catch (err) {
    console.error('Error reading category registry:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to read category registry' }));
  }
}

async function handleCategoryRegistryPut(req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  try {
    const parsed = JSON.parse(body);
    await writeFile(CATEGORY_REGISTRY_PATH, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('Error writing category registry:', err);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
  }
}

async function handleStyleGuidePut(req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  try {
    // Validate JSON
    const parsed = JSON.parse(body);
    // Write pretty-printed
    await writeFile(STYLE_GUIDE_PATH, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    console.error('Error writing style guide:', err);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
  }
}

async function serveStaticFile(pathname, res) {
  // Default to index.html
  if (pathname === '/') pathname = '/index.html';

  const filePath = join(__dirname, pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/api/style-guide') {
    if (req.method === 'GET') {
      await handleStyleGuideGet(res);
    } else if (req.method === 'PUT') {
      await handleStyleGuidePut(req, res);
    } else {
      res.writeHead(405);
      res.end('Method Not Allowed');
    }
  } else if (pathname === '/api/category-registry') {
    if (req.method === 'GET') {
      await handleCategoryRegistryGet(res);
    } else if (req.method === 'PUT') {
      await handleCategoryRegistryPut(req, res);
    } else {
      res.writeHead(405);
      res.end('Method Not Allowed');
    }
  } else {
    await serveStaticFile(pathname, res);
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

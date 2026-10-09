'use strict';

/* ---------------------------------------------------------------------------
 * CPS2 Tools server: serves the static app and a small JSON API for the
 * central library of channels and contacts (SQLite, via node:sqlite).
 *
 *   node server/server.js [--port 8080] [--db ./data/library.db] [--public ./public]
 *   (or env PORT, DB_PATH, PUBLIC_DIR)
 *
 * API
 *   GET    /api/library?type=channel|contact&q=text     list items
 *   POST   /api/library   {type, items:[{name, xml, summary, tags, notes, source}], onConflict}
 *   PUT    /api/library/:id   {name?, tags?, notes?}
 *   POST   /api/library/delete   {ids:[...]}
 *   GET    /api/health
 * ------------------------------------------------------------------------- */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const arg = (name, env, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : process.env[env] || def;
};
const PORT = Number(arg('port', 'PORT', 8080));
const DB_PATH = path.resolve(arg('db', 'DB_PATH', path.join(__dirname, '..', 'data', 'library.db')));
const PUBLIC_DIR = path.resolve(arg('public', 'PUBLIC_DIR', path.join(__dirname, '..', 'public')));
const MAX_BODY = 20 * 1024 * 1024;
const TYPES = new Set(['channel', 'contact']);

/* -------------------------------- Database ------------------------------ */

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS items (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    type     TEXT NOT NULL,
    name     TEXT NOT NULL,
    summary  TEXT NOT NULL DEFAULT '',
    tags     TEXT NOT NULL DEFAULT '',
    notes    TEXT NOT NULL DEFAULT '',
    source   TEXT NOT NULL DEFAULT '',
    xml      TEXT NOT NULL,
    created  TEXT NOT NULL DEFAULT (datetime('now')),
    updated  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS items_type_name ON items(type, name);
`);

const q = {
  list: db.prepare('SELECT * FROM items WHERE type = ? ORDER BY name COLLATE NOCASE, id'),
  byName: db.prepare('SELECT id FROM items WHERE type = ? AND name = ?'),
  names: db.prepare('SELECT name FROM items WHERE type = ?'),
  insert: db.prepare(`INSERT INTO items (type, name, summary, tags, notes, source, xml)
                      VALUES (?, ?, ?, ?, ?, ?, ?)`),
  replace: db.prepare(`UPDATE items SET summary = ?, tags = ?, notes = ?, source = ?, xml = ?,
                       updated = datetime('now') WHERE id = ?`),
  get: db.prepare('SELECT * FROM items WHERE id = ?'),
  update: db.prepare(`UPDATE items SET name = ?, tags = ?, notes = ?, updated = datetime('now') WHERE id = ?`),
  del: db.prepare('DELETE FROM items WHERE id = ?'),
};

const str = (v, max = 100000) => String(v ?? '').slice(0, max);
const cleanTags = (t) => [...new Set(str(t, 1000).split(',').map((s) => s.trim()).filter(Boolean))].join(', ');

function uniqueName(type, base) {
  const names = new Set(q.names.all(type).map((r) => r.name));
  if (!names.has(base)) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`)) return `${base} ${i}`;
}

// onConflict: 'replace' (default) | 'skip' | 'keep' (save a copy with a new name)
function saveItems(type, items, onConflict = 'replace') {
  const res = { added: 0, replaced: 0, skipped: 0 };
  db.exec('BEGIN');
  try {
    for (const it of items) {
      const name = str(it.name, 200).trim();
      const xml = str(it.xml, 2_000_000);
      if (!name || !xml.trim().startsWith('<set')) throw httpError(400, `Item "${name}" has no <set> XML.`);
      const vals = [str(it.summary, 1000), cleanTags(it.tags), str(it.notes, 5000), str(it.source, 200), xml];
      const existing = q.byName.get(type, name);
      if (existing && onConflict === 'skip') { res.skipped++; continue; }
      if (existing && onConflict !== 'keep') { q.replace.run(...vals, existing.id); res.replaced++; continue; }
      q.insert.run(type, existing ? uniqueName(type, name) : name, ...vals);
      res.added++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return res;
}

/* --------------------------------- HTTP --------------------------------- */

function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(httpError(413, 'Request too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(httpError(400, 'Invalid JSON.')); }
    });
    req.on('error', reject);
  });
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'library', ...]
  if (parts[1] === 'health') return send(res, 200, { ok: true });
  if (parts[1] !== 'library') throw httpError(404, 'Not found.');

  // GET /api/library?type=channel&q=text
  if (req.method === 'GET' && parts.length === 2) {
    const type = url.searchParams.get('type');
    if (!TYPES.has(type)) throw httpError(400, 'type must be channel or contact.');
    const text = (url.searchParams.get('q') || '').toLowerCase();
    let rows = q.list.all(type);
    if (text) rows = rows.filter((r) => `${r.name} ${r.summary} ${r.tags} ${r.notes} ${r.source}`.toLowerCase().includes(text));
    return send(res, 200, { items: rows });
  }

  // POST /api/library  (add / replace)
  if (req.method === 'POST' && parts.length === 2) {
    const body = await readJson(req);
    if (!TYPES.has(body.type)) throw httpError(400, 'type must be channel or contact.');
    if (!Array.isArray(body.items) || !body.items.length) throw httpError(400, 'items is empty.');
    return send(res, 200, saveItems(body.type, body.items, body.onConflict));
  }

  // POST /api/library/delete  {ids}
  if (req.method === 'POST' && parts[2] === 'delete') {
    const { ids } = await readJson(req);
    if (!Array.isArray(ids)) throw httpError(400, 'ids must be a list.');
    let n = 0;
    db.exec('BEGIN');
    for (const id of ids) n += Number(q.del.run(Number(id)).changes);
    db.exec('COMMIT');
    return send(res, 200, { deleted: n });
  }

  // PUT /api/library/:id  {name, tags, notes}
  if (req.method === 'PUT' && parts.length === 3) {
    const row = q.get.get(Number(parts[2]));
    if (!row) throw httpError(404, 'Item not found.');
    const body = await readJson(req);
    const name = body.name != null ? str(body.name, 200).trim() : row.name;
    if (!name) throw httpError(400, 'Name cannot be empty.');
    if (name !== row.name && q.byName.get(row.type, name)) throw httpError(409, `"${name}" already exists in the library.`);
    q.update.run(name, body.tags != null ? cleanTags(body.tags) : row.tags, body.notes != null ? str(body.notes, 5000) : row.notes, row.id);
    return send(res, 200, q.get.get(row.id));
  }

  throw httpError(405, 'Method not allowed.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  let rel = decodeURIComponent(url.pathname);
  let file = path.join(PUBLIC_DIR, rel);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
  // /zone -> /zone/ so relative links resolve
  if (!rel.endsWith('/') && fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    return send(res, 301, '', { Location: rel + '/' + url.search });
  }
  if (rel.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    if (!e.status) console.error(e);
    send(res, e.status || 500, { error: e.status ? e.message : 'Server error.' });
  }
});

server.listen(PORT, () => console.log(`CPS2 Tools on :${PORT}  db=${DB_PATH}  public=${PUBLIC_DIR}`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(); db.close(); process.exit(0); });

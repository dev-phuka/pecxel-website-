const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { DatabaseSync } = require('node:sqlite');

const app = express();

if (process.loadEnvFile && fs.existsSync(path.join(__dirname, '.env'))) {
  process.loadEnvFile(path.join(__dirname, '.env'));
}

// ---------- Config ----------
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DB_PATH = path.join(__dirname, 'pecxel-blog.sqlite');
const API_TOKEN = process.env.BLOG_ADMIN_TOKEN;
if (!API_TOKEN) {
  throw new Error('Set BLOG_ADMIN_TOKEN in pecxel-website/.env before starting the server.');
}

// ---------- Middleware ----------
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

// Serve static front-end
app.use(express.static(__dirname));

// ---------- DB ----------
const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode=WAL;

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT,
    date TEXT NOT NULL,
    thumbnail TEXT,
    content_html TEXT NOT NULL,
    content_markdown TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_posts_status_date ON posts(status, date);

  CREATE TABLE IF NOT EXISTS catalog_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image TEXT,
    price_mwk INTEGER,
    stock INTEGER,
    status TEXT NOT NULL DEFAULT 'published',
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(content_type, name)
  );

  CREATE TABLE IF NOT EXISTS site_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    summary TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'published',
    show_in_nav INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL
  );
`);

const catalogSeed = [
  ['product', 'Phones & smartphones', 'phones', 'Explore mobile devices for communication, study, work, and everyday use.', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85'],
  ['product', 'Laptops & computers', 'computers', 'Find a computer suited to learning, business, creative work, or everyday tasks.', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85'],
  ['product', 'Electronic accessories', 'accessories', 'Chargers, cables, audio gear, power banks, storage, and useful add-ons.', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85'],
  ['product', 'Components & tools', 'components', 'Repair parts, electronics components, and tools for hands-on builds.', 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=85'],
  ['service', 'Mobile Phone Repair', 'repair', 'Screen replacement, charging ports, software recovery, battery issues, and motherboard checks.', ''],
  ['service', 'Laptop Repair & Upgrades', 'repair', 'Keyboard, screen, SSD, RAM, operating system, overheating, and diagnostics support.', ''],
  ['service', 'Electrical Services', 'engineering', 'House wiring, commercial installation, solar support, maintenance, and system checks.', ''],
  ['service', 'Electronics & Embedded Systems', 'engineering', 'PCB repair, component replacement, Arduino prototypes, sensors, and custom builds.', ''],
  ['service', 'AI & Software', 'ai', 'Customer assistants, automation, diagnostics concepts, computer vision, and data tools.', ''],
  ['service', 'Training & Workshop Support', 'training', 'Repair coaching, electronics classes, AI fundamentals, accessories, parts, and tools.', ''],
  ['project', 'ViziXel Prototype', 'Accessibility', 'Embedded accessibility concept using sensing, voice support, and AI direction.', 'images/vizixel/WhatsApp Image 2026-06-04 at 15.02.24.jpeg'],
  ['project', 'Industrial Monitoring System', 'Monitoring', 'Sensors and dashboards for equipment visibility, data logging, and operational awareness.', ''],
  ['project', 'Arduino Learning Builds', 'Education', 'Small embedded prototypes that help learners understand sensors, logic, and control.', '']
];
const insertCatalogSeed = db.prepare(
  `INSERT OR IGNORE INTO catalog_items
   (content_type, name, category, description, image, status, position, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?)`
);
catalogSeed.forEach((item, index) => {
  const timestamp = nowIso();
  insertCatalogSeed.run(...item, index, timestamp, timestamp);
});

const settingDefaults = {
  site_name: 'pEc-XeL',
  brand_descriptor: 'Innovations & Technology',
  tagline: 'Electrical is Passion. Electronics is Life.',
  whatsapp_number: '265YOURNUMBER',
  contact_email: 'info@pecxel.com',
  location: 'Malawi',
  working_hours: 'Monday to Saturday',
  facebook_url: '',
  instagram_url: '',
  linkedin_url: '',
  youtube_url: ''
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES (?, ?)');
Object.entries(settingDefaults).forEach(([key, value]) => insertSetting.run(key, value));

// ---------- Helpers ----------
function requireAdmin(req, res, next) {
  // Simple token auth for demo purposes.
  // Client sends: Authorization: Bearer <token>
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  if (!token || token !== API_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'published' || v === 'draft') return v;
  return 'draft';
}

function generateSlug(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const catalogTypes = new Set(['product', 'service', 'project']);
const settingKeys = new Set(Object.keys(settingDefaults));

function validCatalogType(type) {
  return catalogTypes.has(String(type || '').toLowerCase());
}

function optionalInteger(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

function getSiteSettings() {
  return Object.fromEntries(
    db.prepare('SELECT setting_key, setting_value FROM site_settings').all()
      .map((row) => [row.setting_key, row.setting_value])
  );
}

app.get('/api/catalog/:type', (req, res) => {
  const type = String(req.params.type || '').replace(/s$/, '').toLowerCase();
  if (!validCatalogType(type)) return res.status(404).json({ error: 'Catalog type not found' });
  const items = db.prepare(
    `SELECT id, content_type, name, category, description, image, price_mwk, stock, status, position
     FROM catalog_items WHERE content_type = ? AND status = 'published'
     ORDER BY position, id`
  ).all(type);
  res.json({ items });
});

app.get('/api/pages', (req, res) => {
  const pages = db.prepare(
    `SELECT id, title, slug, summary FROM site_pages
     WHERE status = 'published' AND show_in_nav = 1 ORDER BY title`
  ).all();
  res.json({ pages });
});

app.get('/api/pages/:slug', (req, res) => {
  const page = db.prepare(
    `SELECT title, slug, summary, body FROM site_pages WHERE slug = ? AND status = 'published'`
  ).get(req.params.slug);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json({ page });
});

app.get('/api/site-settings', (req, res) => {
  res.json({ settings: getSiteSettings() });
});

app.post('/api/admin/uploads/sign', requireAdmin, (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: 'Image uploads are not configured. Add the Cloudinary credentials to the server environment.' });
  }

  const params = {
    allowed_formats: 'jpg,jpeg,png,webp,avif,heic,heif',
    folder: 'pecxel-website',
    timestamp: Math.floor(Date.now() / 1000)
  };
  const signatureBase = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  const signature = crypto.createHash('sha1')
    .update(`${signatureBase}${apiSecret}`)
    .digest('hex');

  res.json({ cloudName, apiKey, ...params, signature });
});

app.get('/api/admin/catalog/:type', requireAdmin, (req, res) => {
  const type = String(req.params.type || '').replace(/s$/, '').toLowerCase();
  if (!validCatalogType(type)) return res.status(404).json({ error: 'Catalog type not found' });
  const items = db.prepare(
    `SELECT id, content_type, name, category, description, image, price_mwk, stock, status, position
     FROM catalog_items WHERE content_type = ? ORDER BY position, id`
  ).all(type);
  res.json({ items });
});

app.post('/api/admin/catalog/:type', requireAdmin, (req, res) => {
  const type = String(req.params.type || '').replace(/s$/, '').toLowerCase();
  if (!validCatalogType(type)) return res.status(404).json({ error: 'Catalog type not found' });
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  const price = optionalInteger(body.price_mwk);
  const stock = optionalInteger(body.stock);
  const position = body.position === '' || body.position === undefined ? 0 : optionalInteger(body.position);
  if (price === undefined || stock === undefined || position === undefined) {
    return res.status(400).json({ error: 'Price, stock, and position must be non-negative whole numbers' });
  }
  const timestamp = nowIso();
  try {
    const result = db.prepare(
      `INSERT INTO catalog_items
       (content_type, name, category, description, image, price_mwk, stock, status, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      type, name, String(body.category || '').trim(), String(body.description || '').trim(),
      body.image ? String(body.image).trim() : null, price, stock, normalizeStatus(body.status),
      position, timestamp, timestamp
    );
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'An item with this name already exists' });
    res.status(500).json({ error: 'Unable to save catalog item' });
  }
});

app.put('/api/admin/catalog/:type/:id', requireAdmin, (req, res) => {
  const type = String(req.params.type || '').replace(/s$/, '').toLowerCase();
  const id = Number(req.params.id);
  if (!validCatalogType(type)) return res.status(404).json({ error: 'Catalog type not found' });
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  const price = optionalInteger(body.price_mwk);
  const stock = optionalInteger(body.stock);
  const position = body.position === '' || body.position === undefined ? 0 : optionalInteger(body.position);
  if (price === undefined || stock === undefined || position === undefined) {
    return res.status(400).json({ error: 'Price, stock, and position must be non-negative whole numbers' });
  }
  try {
    const result = db.prepare(
      `UPDATE catalog_items SET name = ?, category = ?, description = ?, image = ?, price_mwk = ?, stock = ?,
       status = ?, position = ?, updated_at = ? WHERE id = ? AND content_type = ?`
    ).run(
      name, String(body.category || '').trim(), String(body.description || '').trim(),
      body.image ? String(body.image).trim() : null, price, stock, normalizeStatus(body.status),
      position, nowIso(), id, type
    );
    if (!result.changes) return res.status(404).json({ error: 'Catalog item not found' });
    res.json({ ok: true });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'An item with this name already exists' });
    res.status(500).json({ error: 'Unable to update catalog item' });
  }
});

app.delete('/api/admin/catalog/:type/:id', requireAdmin, (req, res) => {
  const type = String(req.params.type || '').replace(/s$/, '').toLowerCase();
  const id = Number(req.params.id);
  if (!validCatalogType(type)) return res.status(404).json({ error: 'Catalog type not found' });
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const result = db.prepare('DELETE FROM catalog_items WHERE id = ? AND content_type = ?').run(id, type);
  if (!result.changes) return res.status(404).json({ error: 'Catalog item not found' });
  res.json({ ok: true });
});

app.get('/api/admin/pages', requireAdmin, (req, res) => {
  const pages = db.prepare(
    'SELECT id, title, slug, summary, body, status, show_in_nav FROM site_pages ORDER BY title'
  ).all();
  res.json({ pages });
});

app.post('/api/admin/pages', requireAdmin, (req, res) => {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const slug = String(body.slug || generateSlug(title)).trim();
  if (!title || !slug) return res.status(400).json({ error: 'title and slug are required' });
  const timestamp = nowIso();
  try {
    const result = db.prepare(
      `INSERT INTO site_pages (title, slug, summary, body, status, show_in_nav, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      title, slug, String(body.summary || '').trim(), String(body.body || '').trim(),
      normalizeStatus(body.status), body.show_in_nav === false ? 0 : 1, timestamp, timestamp
    );
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'This page address is already in use' });
    res.status(500).json({ error: 'Unable to save page' });
  }
});

app.put('/api/admin/pages/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const slug = String(body.slug || generateSlug(title)).trim();
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: 'invalid id' });
  if (!title || !slug) return res.status(400).json({ error: 'title and slug are required' });
  try {
    const result = db.prepare(
      `UPDATE site_pages SET title = ?, slug = ?, summary = ?, body = ?, status = ?, show_in_nav = ?, updated_at = ? WHERE id = ?`
    ).run(
      title, slug, String(body.summary || '').trim(), String(body.body || '').trim(),
      normalizeStatus(body.status), body.show_in_nav === false ? 0 : 1, nowIso(), id
    );
    if (!result.changes) return res.status(404).json({ error: 'Page not found' });
    res.json({ ok: true });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'This page address is already in use' });
    res.status(500).json({ error: 'Unable to update page' });
  }
});

app.delete('/api/admin/pages/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const result = db.prepare('DELETE FROM site_pages WHERE id = ?').run(id);
  if (!result.changes) return res.status(404).json({ error: 'Page not found' });
  res.json({ ok: true });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json({ settings: getSiteSettings() });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const settings = req.body && req.body.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return res.status(400).json({ error: 'settings object is required' });
  }
  const updateSetting = db.prepare(
    'INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value'
  );
  Object.entries(settings).forEach(([key, value]) => {
    if (settingKeys.has(key)) updateSetting.run(key, String(value || '').trim());
  });
  res.json({ ok: true, settings: getSiteSettings() });
});

// ---------- Public API (blog) ----------
app.get('/api/posts', (req, res) => {
  const status = req.query.status;
  const where = status ? 'WHERE status = ?' : "WHERE status = 'published'";
  const sql = `SELECT id, title, slug, category, date, thumbnail, status, created_at, updated_at
               FROM posts
               ${where}
               ORDER BY date DESC LIMIT 50`;

  const rows = status ? db.prepare(sql).all(status) : db.prepare(sql).all();
  res.json({ posts: rows });
});

app.get('/api/posts/:slug', (req, res) => {
  const post = db
    .prepare(
      `SELECT id, title, slug, category, date, thumbnail, content_html, content_markdown, status,
              created_at, updated_at
       FROM posts
       WHERE slug = ? AND (status = 'published' OR ? = 'admin')`
    )
    .get(req.params.slug, req.query.role === 'admin' ? 'admin' : 'guest');

  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json({ post });
});

// ---------- Donations (reuse posts table) ----------
// Public: published donation content
app.get('/api/donations', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, slug, category, date, thumbnail, status,
              created_at, updated_at, content_html
       FROM posts
       WHERE status = 'published' AND (category = 'donation' OR category = 'donations')
       ORDER BY date DESC LIMIT 5`
    )
    .all();

  res.json({ donations: rows });
});

// Admin: donation content
app.get('/api/admin/donations', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, slug, category, date, thumbnail, status,
              created_at, updated_at, content_html, content_markdown
       FROM posts
       WHERE category = 'donation' OR category = 'donations'
       ORDER BY date DESC LIMIT 200`
    )
    .all();

  res.json({ donations: rows });
});

// ---------- Admin API (Posts) ----------
app.get('/api/admin/posts', requireAdmin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, title, slug, category, date, thumbnail, content_html, content_markdown, status,
              created_at, updated_at
       FROM posts
       ORDER BY date DESC LIMIT 200`
    )
    .all();
  res.json({ posts: rows });
});

app.post('/api/admin/posts', requireAdmin, (req, res) => {
  const body = req.body || {};

  const title = String(body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title is required' });

  const slug = String(body.slug || generateSlug(title)).trim();
  if (!slug) return res.status(400).json({ error: 'slug is required' });

  const category = body.category ? String(body.category) : null;
  const date = body.date ? String(body.date) : nowIso().slice(0, 10);
  const thumbnail = body.thumbnail ? String(body.thumbnail) : null;

  const status = normalizeStatus(body.status);

  // content_html is required for rendering.
  const content_html = body.content_html ? String(body.content_html) : '';
  if (!content_html.trim()) return res.status(400).json({ error: 'content_html is required' });

  const content_markdown = body.content_markdown ? String(body.content_markdown) : null;

  const created_at = nowIso();
  const updated_at = created_at;

  try {
    const info = db
      .prepare(
        `INSERT INTO posts (title, slug, category, date, thumbnail, content_html, content_markdown, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(title, slug, category, date, thumbnail, content_html, content_markdown, status, created_at, updated_at);

    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'slug already exists' });
    }
    return res.status(500).json({ error: 'db error', details: String(e && e.message) });
  }
});

app.put('/api/admin/posts/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

  const body = req.body || {};

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const title = body.title !== undefined ? String(body.title || '').trim() : null;
  const slug = body.slug !== undefined ? String(body.slug || '').trim() : null;
  const category = body.category !== undefined ? (body.category ? String(body.category) : null) : undefined;
  const date = body.date !== undefined ? String(body.date) : undefined;
  const thumbnail = body.thumbnail !== undefined ? (body.thumbnail ? String(body.thumbnail) : null) : undefined;
  const status = body.status !== undefined ? normalizeStatus(body.status) : undefined;

  const content_html = body.content_html !== undefined ? String(body.content_html || '') : undefined;
  const content_markdown = body.content_markdown !== undefined ? (body.content_markdown ? String(body.content_markdown) : null) : undefined;

  // Build dynamic SQL safely by listing known fields
  const fields = [];
  const values = [];

  if (title !== null && title) { fields.push('title = ?'); values.push(title); }
  if (slug !== null && slug) { fields.push('slug = ?'); values.push(slug); }
  if (category !== undefined) { fields.push('category = ?'); values.push(category); }
  if (date !== undefined) { fields.push('date = ?'); values.push(date); }
  if (thumbnail !== undefined) { fields.push('thumbnail = ?'); values.push(thumbnail); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  if (content_html !== undefined) { if (!content_html.trim()) return res.status(400).json({ error: 'content_html cannot be empty' }); fields.push('content_html = ?'); values.push(content_html); }
  if (content_markdown !== undefined) { fields.push('content_markdown = ?'); values.push(content_markdown); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push('updated_at = ?');
  values.push(nowIso());

  const sql = `UPDATE posts SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  try {
    db.prepare(sql).run(...values);
    res.json({ ok: true });
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'slug already exists' });
    }
    return res.status(500).json({ error: 'db error', details: String(e && e.message) });
  }
});

app.delete('/api/admin/posts/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

  const info = db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Post not found' });
  res.json({ ok: true });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`pecxel blog server running on http://localhost:${PORT}`);
  console.log('Website manager: /admin.html');
});

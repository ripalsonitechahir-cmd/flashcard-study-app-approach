const path = require('path');
const fs = require('fs');
const express = require('express');
const prisma = require('./db');

const DEFAULT_DECK = 'General';
const RESULT_STATUS = { knew: 'known', practice: 'practice' };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Validates front/back/deck. With `partial`, only supplied fields are checked.
function parseCardInput(body, { partial = false } = {}) {
  const data = {};
  for (const field of ['front', 'back']) {
    if (body[field] === undefined && partial) continue;
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      throw new HttpError(400, `"${field}" is required and cannot be empty`);
    }
    data[field] = body[field].trim();
  }
  if (body.deck !== undefined && body.deck !== null && typeof body.deck !== 'string') {
    throw new HttpError(400, '"deck" must be a string');
  }
  if (body.deck !== undefined || !partial) {
    data.deck = (body.deck || '').trim() || DEFAULT_DECK;
  }
  return data;
}

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(404, 'Card not found');
  return id;
}

async function findCard(rawId) {
  const card = await prisma.card.findUnique({ where: { id: parseId(rawId) } });
  if (!card) throw new HttpError(404, 'Card not found');
  return card;
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.post('/cards', wrap(async (req, res) => {
    const card = await prisma.card.create({ data: parseCardInput(req.body || {}) });
    res.status(201).json(card);
  }));

  // Optional ?deck= and ?q= (keyword search over front/back)
  app.get('/cards', wrap(async (req, res) => {
    const where = {};
    if (req.query.deck) where.deck = String(req.query.deck);
    if (req.query.q) {
      const q = String(req.query.q);
      where.OR = [{ front: { contains: q } }, { back: { contains: q } }];
    }
    res.json(await prisma.card.findMany({ where, orderBy: { id: 'asc' } }));
  }));

  app.get('/decks', wrap(async (req, res) => {
    const groups = await prisma.card.groupBy({ by: ['deck'], _count: { _all: true }, orderBy: { deck: 'asc' } });
    res.json(groups.map((g) => ({ name: g.deck, count: g._count._all })));
  }));

  app.put('/cards/:id', wrap(async (req, res) => {
    const existing = await findCard(req.params.id);
    const data = parseCardInput(req.body || {}, { partial: true });
    res.json(await prisma.card.update({ where: { id: existing.id }, data }));
  }));

  app.delete('/cards/:id', wrap(async (req, res) => {
    const existing = await findCard(req.params.id);
    await prisma.card.delete({ where: { id: existing.id } });
    res.status(204).end();
  }));

  // Next card to study: cards needing practice first, then new, then known.
  // ?exclude=1,2 skips cards already seen this round; ?shuffle=true randomises within a tier.
  app.get('/study/next', wrap(async (req, res) => {
    const where = {};
    if (req.query.deck) where.deck = String(req.query.deck);
    const exclude = String(req.query.exclude || '').split(',').map(Number).filter(Number.isInteger);
    if (exclude.length) where.id = { notIn: exclude };

    const cards = await prisma.card.findMany({ where, orderBy: { id: 'asc' } });
    if (!cards.length) throw new HttpError(404, 'No cards available to study');

    const rank = { practice: 0, new: 1, known: 2 };
    const bestRank = Math.min(...cards.map((c) => rank[c.status] ?? 1));
    const tier = cards.filter((c) => (rank[c.status] ?? 1) === bestRank);
    const pick = req.query.shuffle === 'true' ? tier[Math.floor(Math.random() * tier.length)] : tier[0];
    res.json(pick);
  }));

  app.post('/cards/:id/result', wrap(async (req, res) => {
    const existing = await findCard(req.params.id);
    const status = RESULT_STATUS[(req.body || {}).result];
    if (!status) throw new HttpError(400, 'Invalid result: must be "knew" or "practice"');
    res.json(await prisma.card.update({
      where: { id: existing.id },
      data: { status, lastStudiedAt: new Date() },
    }));
  }));

  app.get('/stats', wrap(async (req, res) => {
    const where = req.query.deck ? { deck: String(req.query.deck) } : {};
    const [total, known, practice] = await Promise.all([
      prisma.card.count({ where }),
      prisma.card.count({ where: { ...where, status: 'known' } }),
      prisma.card.count({ where: { ...where, status: 'practice' } }),
    ]);
    res.json({ total, known, practice, new: total - known - practice });
  }));

  // Serve the built React app when present (Docker / production)
  const staticDir = process.env.STATIC_DIR || path.join(__dirname, '..', 'public');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get(/^\/(?!cards|study|stats|decks|health).*/, (req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof SyntaxError && err.status === 400) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };

process.env.DATABASE_URL = 'file:./test.db';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const path = require('node:path');

let server, base, prisma;

const call = async (method, url, body) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

before(async () => {
  execSync('npx prisma migrate deploy', { cwd: path.join(__dirname, '..'), stdio: 'ignore', env: process.env });
  prisma = require('../src/db');
  server = require('../src/app').createApp().listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(async () => { server.close(); await prisma.$disconnect(); });
beforeEach(async () => { await prisma.card.deleteMany(); });

test('create card defaults deck to General', async () => {
  const r = await call('POST', '/cards', { front: ' Q ', back: 'A' });
  assert.equal(r.status, 201);
  assert.equal(r.body.deck, 'General');
  assert.equal(r.body.front, 'Q');
});

test('create rejects empty front or back', async () => {
  assert.equal((await call('POST', '/cards', { front: '', back: 'A' })).status, 400);
  assert.equal((await call('POST', '/cards', { front: 'Q', back: '   ' })).status, 400);
  assert.equal((await call('POST', '/cards', {})).status, 400);
});

test('list filters by deck and keyword', async () => {
  await call('POST', '/cards', { front: 'Capital of France', back: 'Paris', deck: 'Geo' });
  await call('POST', '/cards', { front: '2+2', back: '4' });
  assert.equal((await call('GET', '/cards')).body.length, 2);
  assert.equal((await call('GET', '/cards?deck=Geo')).body.length, 1);
  assert.equal((await call('GET', '/cards?q=Paris')).body.length, 1);
  assert.equal((await call('GET', '/cards?deck=Nope')).body.length, 0);
});

test('update card and reject empty / missing', async () => {
  const { body: c } = await call('POST', '/cards', { front: 'Q', back: 'A' });
  const ok = await call('PUT', `/cards/${c.id}`, { front: 'Q2', back: 'A2', deck: 'X' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.deck, 'X');
  assert.equal((await call('PUT', `/cards/${c.id}`, { front: '' })).status, 400);
  assert.equal((await call('PUT', '/cards/9999', { front: 'a', back: 'b' })).status, 404);
});

test('delete card and 404 on missing', async () => {
  const { body: c } = await call('POST', '/cards', { front: 'Q', back: 'A' });
  assert.equal((await call('DELETE', `/cards/${c.id}`)).status, 204);
  assert.equal((await call('DELETE', `/cards/${c.id}`)).status, 404);
  assert.equal((await call('DELETE', '/cards/abc')).status, 404);
});

test('study/next 404 when empty, prefers practice cards', async () => {
  assert.equal((await call('GET', '/study/next')).status, 404);
  const a = (await call('POST', '/cards', { front: 'a', back: 'a' })).body;
  const b = (await call('POST', '/cards', { front: 'b', back: 'b' })).body;
  await call('POST', `/cards/${a.id}/result`, { result: 'knew' });
  assert.equal((await call('GET', '/study/next')).body.id, b.id); // new before known
  await call('POST', `/cards/${b.id}/result`, { result: 'knew' });
  await call('POST', `/cards/${a.id}/result`, { result: 'practice' });
  assert.equal((await call('GET', '/study/next')).body.id, a.id); // practice first
  assert.equal((await call('GET', `/study/next?exclude=${a.id}`)).body.id, b.id);
});

test('result validates value and card existence', async () => {
  const { body: c } = await call('POST', '/cards', { front: 'Q', back: 'A' });
  assert.equal((await call('POST', `/cards/${c.id}/result`, { result: 'maybe' })).status, 400);
  assert.equal((await call('POST', `/cards/${c.id}/result`, {})).status, 400);
  assert.equal((await call('POST', '/cards/9999/result', { result: 'knew' })).status, 404);
});

test('stats totals', async () => {
  const a = (await call('POST', '/cards', { front: 'a', back: 'a' })).body;
  const b = (await call('POST', '/cards', { front: 'b', back: 'b' })).body;
  await call('POST', '/cards', { front: 'c', back: 'c' });
  await call('POST', `/cards/${a.id}/result`, { result: 'knew' });
  await call('POST', `/cards/${b.id}/result`, { result: 'practice' });
  assert.deepEqual((await call('GET', '/stats')).body, { total: 3, known: 1, practice: 1, new: 1 });
});

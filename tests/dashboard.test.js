'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { createDashboardServer, parseFrontmatter, recommendComponents, buildCatalogItems } = require('../dashboard/server');

async function startTestServer() {
  const server = createDashboardServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

test('parseFrontmatter extracts YAML name, description, and body', () => {
  const parsed = parseFrontmatter('---\nname: demo-skill\ndescription: A futuristic skill\n---\n\n# Demo\nBody text');
  assert.equal(parsed.title, 'demo-skill');
  assert.equal(parsed.description, 'A futuristic skill');
  assert.match(parsed.body, /Body text/);
});

test('recommendComponents matches English and Persian queries', () => {
  const { items } = buildCatalogItems();
  const en = recommendComponents('liquid glass frontend', items);
  assert.ok(en.matches.some(m => m.id === 'liquid-glass-design'));
  assert.match(en.command, /^ecc-install --skills /);

  const fa = recommendComponents('تست و امنیت و معماری', items);
  assert.ok(fa.matches.length > 0);
  assert.ok(fa.matches.some(m => ['tdd-workflow', 'e2e-testing', 'architect', 'code-reviewer'].includes(m.id)));
});

test('dashboard HTTP server serves PWA shell, manifest, service worker, and API endpoints', async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    assert.match(htmlRes.headers.get('content-type'), /text\/html/);
    const html = await htmlRes.text();
    assert.match(html, /manifest\.webmanifest/);
    assert.match(html, /Aether/);

    const swRes = await fetch(`${baseUrl}/sw.js`);
    assert.equal(swRes.status, 200);
    assert.equal(swRes.headers.get('service-worker-allowed'), '/');

    const manifestRes = await fetch(`${baseUrl}/manifest.webmanifest`);
    assert.equal(manifestRes.status, 200);
    const manifest = await manifestRes.json();
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.icons.some(i => i.sizes === '192x192'));
    assert.ok(manifest.icons.some(i => i.sizes === '512x512'));

    const iconRes = await fetch(`${baseUrl}/icons/icon-192.png`);
    assert.equal(iconRes.status, 200);
    assert.equal(iconRes.headers.get('content-type'), 'image/png');

    const statusRes = await fetch(`${baseUrl}/api/status`);
    assert.equal(statusRes.status, 200);
    const status = await statusRes.json();
    assert.equal(status.ok, true);
    assert.equal(status.counts.skills, 21);
    assert.equal(status.counts.agents, 9);
    assert.equal(status.counts.commands, 30);
    assert.equal(status.counts.shims, 6);
    assert.ok(status.targets.some(t => t.target === 'arena' && t.installed === true));

    const catRes = await fetch(`${baseUrl}/api/catalog`);
    const cat = await catRes.json();
    assert.equal(cat.items.length, 66);

    const compRes = await fetch(`${baseUrl}/api/component/skill/liquid-glass-design`);
    assert.equal(compRes.status, 200);
    const comp = await compRes.json();
    assert.equal(comp.id, 'liquid-glass-design');
    assert.match(comp.content, /Liquid Glass/);

    const recRes = await fetch(`${baseUrl}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'playwright e2e test' }),
    });
    const rec = await recRes.json();
    assert.equal(rec.ok, true);
    assert.ok(rec.matches.some(m => m.id === 'e2e-testing' || m.id === 'e2e-runner'));

    const previewRes = await fetch(`${baseUrl}/api/install-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'arena', skills: ['liquid-glass-design', 'tdd'] }),
    });
    const preview = await previewRes.json();
    assert.equal(preview.ok, true);
    assert.equal(preview.applied, false);
    assert.equal(preview.target, 'arena');
    assert.ok(preview.operationCount >= 3);

    const auditRes = await fetch(`${baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'audit' }),
    });
    const audit = await auditRes.json();
    assert.equal(audit.ok, true);
    assert.deepEqual(audit.issues, []);

    // Verify path traversal is blocked via raw http request (normalized URLs won't pass fetch)
    const traversalStatus = await new Promise((resolve, reject) => {
      const req = http.get(`${baseUrl}/../package.json`, res => resolve(res.statusCode));
      req.on('error', reject);
    });
    assert.ok(traversalStatus === 403 || traversalStatus === 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

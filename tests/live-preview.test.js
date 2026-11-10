'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const { buildStaticPreview } = require('../dashboard/scripts/build-preview');
const {
  COMMENT_MARKER,
  buildPreviewSummaryMarkdown,
  parseTunnelUrl,
  runLivePreview,
  writeGitHubOutputs,
} = require('../.github/actions/live-preview/runner');

const REPO_ROOT = path.resolve(__dirname, '..');

test('buildStaticPreview generates subpath-safe static bundle for GitHub Pages', async () => {
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-static-preview-'));
  try {
    const res = buildStaticPreview({ repoRoot: REPO_ROOT, outDir: tmpOut });
    assert.equal(res.componentCount, 66);
    assert.ok(fs.existsSync(path.join(tmpOut, 'index.html')));
    assert.ok(fs.existsSync(path.join(tmpOut, '404.html')));
    assert.ok(fs.existsSync(path.join(tmpOut, '.nojekyll')));
    assert.ok(fs.existsSync(path.join(tmpOut, 'ios27-tokens.json')));
    assert.ok(fs.existsSync(path.join(tmpOut, 'sw.js')));

    const html = fs.readFileSync(path.join(tmpOut, 'index.html'), 'utf8');
    assert.match(html, /href="\.\/manifest\.webmanifest"/);
    assert.match(html, /href="\.\/styles\.css\?v=27\.1\.5"/);
    assert.match(html, /src="\.\/app\.js\?v=27\.1\.5"/);

    const manifest = JSON.parse(fs.readFileSync(path.join(tmpOut, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.start_url, './?source=pwa');
    assert.equal(manifest.scope, './');
    assert.ok(manifest.icons.every(i => i.src.startsWith('./')));

    const bundle = JSON.parse(fs.readFileSync(path.join(tmpOut, 'preview-data', 'bundle.json'), 'utf8'));
    assert.equal(bundle.ok, true);
    assert.equal(bundle.previewMode, 'static-pages');
    assert.equal(bundle.status.counts.total, 66);
    assert.equal(bundle.catalog.items.length, 66);
    assert.equal(Object.keys(bundle.components).length, 66);
    assert.match(bundle.components['skill/liquid-glass-design'].content, /Liquid Glass/);

    // Verify serving from a subpath (/Ecc/) over static HTTP without /api/*
    const mime = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.webmanifest': 'application/manifest+json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    };
    const staticServer = http.createServer((req, res) => {
      const urlPath = new URL(req.url, 'http://127.0.0.1').pathname;
      const rel = urlPath.replace(/^\/Ecc\/?/, '') || 'index.html';
      const target = path.join(tmpOut, rel);
      if (!target.startsWith(tmpOut) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(target);
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      fs.createReadStream(target).pipe(res);
    });
    await new Promise(r => staticServer.listen(0, '127.0.0.1', r));
    try {
      const { port } = staticServer.address();
      const page = await fetch(`http://127.0.0.1:${port}/Ecc/`);
      assert.equal(page.status, 200);
      const bundleRes = await fetch(`http://127.0.0.1:${port}/Ecc/preview-data/bundle.json`);
      assert.equal(bundleRes.status, 200);
      const tokensRes = await fetch(`http://127.0.0.1:${port}/Ecc/ios27-tokens.json`);
      assert.equal(tokensRes.status, 200);
      const appJs = await (await fetch(`http://127.0.0.1:${port}/Ecc/app.js?v=27.1.5`)).text();
      assert.match(appJs, /preview-data\/bundle\.json/);
      assert.match(appJs, /serviceWorker\.register\('\.\/sw\.js'/);
    } finally {
      await new Promise(r => staticServer.close(r));
    }
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }
});

test('live-preview runner helpers parse tunnel URLs and generate GitHub outputs/summaries', () => {
  assert.equal(
    parseTunnelUrl('INF |  https://aether-demo-test.trycloudflare.com  |', 'cloudflared'),
    'https://aether-demo-test.trycloudflare.com'
  );
  assert.equal(
    parseTunnelUrl('tunneled with tls termination, https://ecc99.lhr.life', 'localhost.run'),
    'https://ecc99.lhr.life'
  );
  assert.equal(
    parseTunnelUrl('your url is: https://ecc-demo.loca.lt', 'localtunnel'),
    'https://ecc-demo.loca.lt'
  );

  const md = buildPreviewSummaryMarkdown({
    url: 'https://ecc-demo.trycloudflare.com',
    provider: 'cloudflared',
    port: 3000,
    minutes: 15,
    expiresAt: '2026-11-09T12:15:00.000Z',
    runUrl: 'https://github.com/carol19932027/Ecc/actions/runs/1',
    pagesUrl: 'https://carol19932027.github.io/Ecc/',
  });
  assert.ok(md.includes(COMMENT_MARKER));
  assert.match(md, /https:\/\/ecc-demo\.trycloudflare\.com/);
  assert.match(md, /https:\/\/carol19932027\.github\.io\/Ecc\//);

  const tmpOutFile = path.join(os.tmpdir(), `gh-out-${Date.now()}.txt`);
  try {
    writeGitHubOutputs({ url: 'https://example.trycloudflare.com', provider: 'cloudflared' }, tmpOutFile);
    const outText = fs.readFileSync(tmpOutFile, 'utf8');
    assert.match(outText, /^url=https:\/\/example\.trycloudflare\.com/m);
    assert.match(outText, /^provider=cloudflared/m);
  } finally {
    fs.rmSync(tmpOutFile, { force: true });
  }
});

test('live-preview runner starts dashboard server, passes /api/health, and records outputs in provider=none mode', async () => {
  const probeSrv = http.createServer((req, res) => res.end('ok'));
  await new Promise(r => probeSrv.listen(0, '127.0.0.1', r));
  const freePort = probeSrv.address().port;
  await new Promise(r => probeSrv.close(r));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-lp-run-'));
  const outputPath = path.join(tmpDir, 'github_output.txt');
  const summaryPath = path.join(tmpDir, 'github_summary.md');

  try {
    await runLivePreview({
      ...process.env,
      INPUT_PORT: String(freePort),
      INPUT_COMMAND: 'node dashboard/server.js',
      INPUT_MINUTES: '0',
      INPUT_PROVIDER: 'none',
      INPUT_HEALTH_PATH: '/api/health',
      INPUT_STARTUP_TIMEOUT: '15',
      INPUT_COMMENT_ON_PR: 'false',
      GITHUB_OUTPUT: outputPath,
      GITHUB_STEP_SUMMARY: summaryPath,
      GITHUB_REPOSITORY: 'carol19932027/Ecc',
    });

    const outputs = fs.readFileSync(outputPath, 'utf8');
    assert.match(outputs, /^provider=none$/m);
    assert.match(outputs, /^expires_at=/m);

    const summary = fs.readFileSync(summaryPath, 'utf8');
    assert.match(summary, /Aether ECC Live Preview/);
    assert.match(summary, /Verified \(Health Check Passed\)/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CI/CD and live-preview workflow YAML files are well-formed and complete', () => {
  const ci = fs.readFileSync(path.join(REPO_ROOT, '.github', 'workflows', 'ci-cd.yml'), 'utf8');
  const lp = fs.readFileSync(path.join(REPO_ROOT, '.github', 'workflows', 'live-preview.yml'), 'utf8');
  const actionYml = fs.readFileSync(path.join(REPO_ROOT, '.github', 'actions', 'live-preview', 'action.yml'), 'utf8');

  assert.match(ci, /npm test/);
  assert.match(ci, /npm run build:preview/);
  assert.match(ci, /runAuditAction/);
  assert.match(ci, /actions\/deploy-pages@v4/);
  assert.match(ci, /uses:\s*\.\/\.github\/actions\/live-preview/);
  assert.match(lp, /workflow_dispatch:/);
  assert.match(lp, /uses:\s*\.\/\.github\/actions\/live-preview/);
  assert.match(lp, /secrets\.DISCORD_WEBHOOK_URL/);
  assert.match(actionYml, /using:\s*'composite'/);
  assert.match(actionYml, /steps\.preview\.outputs\.url/);
});

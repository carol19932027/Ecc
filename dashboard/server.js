'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const {
  DEFAULT_REPO_ROOT,
  SUPPORTED_TARGETS,
  applyInstallPlan,
  createInstallPlan,
  discoverCatalog,
  resolveTargetSpec,
} = require('../lib/ecc-installer');

const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
});

const PERSIAN_INTENT_ALIASES = Object.freeze({
  'تست': ['tdd', 'test', 'coverage', 'e2e', 'playwright'],
  'امنیت': ['security', 'review', 'audit', 'verification'],
  'معماری': ['architect', 'blueprint', 'design', 'api'],
  'طراحی': ['liquid-glass', 'frontend', 'ui', 'design', 'blueprint'],
  'شیشه': ['liquid-glass-design', 'ui', 'frontend'],
  'دیتابیس': ['database', 'migrations', 'schema'],
  'پایگاه': ['database', 'migrations'],
  'دیپلوی': ['deployment', 'docker', 'ci', 'build'],
  'استقرار': ['deployment', 'verification'],
  'برنامه': ['plan', 'planner', 'blueprint', 'multi-plan'],
  'پلن': ['plan', 'planner', 'multi-plan'],
  'مستند': ['doc', 'docs', 'codemaps', 'update-docs'],
  'بازبینی': ['code-review', 'code-reviewer', 'harness-audit'],
  'ریفکتور': ['refactor', 'clean', 'refactor-cleaner'],
  'بهینه': ['optimizer', 'prompt-optimizer', 'harness-optimizer', 'compact'],
  'حافظه': ['session', 'sessions', 'save-session', 'resume-session', 'learning'],
  'یادگیری': ['continuous-learning', 'learn', 'instinct', 'evolve'],
  'ایجنت': ['agent', 'orchestrate', 'autonomous', 'loop'],
  'حلقه': ['loop', 'autonomous-loops', 'verification-loop'],
  'ارزیابی': ['eval', 'eval-harness', 'learn-eval'],
});

function parseFrontmatter(markdown) {
  const text = String(markdown || '');
  const meta = {};
  let body = text;

  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (match) {
    const rawMeta = match[1];
    body = match[2];
    for (const line of rawMeta.split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (key && val) meta[key] = val;
      }
    }
  }

  let heading = null;
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^#\s+(.+)$/);
    if (h) {
      heading = h[1].trim();
      break;
    }
  }

  let summary = meta.description || '';
  if (!summary) {
    const lines = body
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('|'));
    summary = lines[0] || '';
  }

  return {
    title: meta.name || heading || '',
    description: summary,
    meta,
    body: body.trim(),
  };
}

function getComponentFilePath(repoRoot, catalog, kind, id) {
  if (kind === 'skill' && catalog.skillSet.has(id)) {
    const p = path.join(repoRoot, 'skills', id, 'SKILL.md');
    if (fs.existsSync(p)) return p;
    const files = fs.readdirSync(path.join(repoRoot, 'skills', id));
    const md = files.find(f => f.endsWith('.md'));
    return md ? path.join(repoRoot, 'skills', id, md) : null;
  }
  if (kind === 'agent' && catalog.agentSet.has(id)) {
    return path.join(repoRoot, 'agents', `${id}.md`);
  }
  if (kind === 'command' && catalog.commandSet.has(id)) {
    return path.join(repoRoot, 'commands', `${id}.md`);
  }
  if (kind === 'shim' && catalog.shimSet.has(id)) {
    return path.join(repoRoot, 'legacy-command-shims', 'commands', `${id}.md`);
  }
  return null;
}

function buildCatalogItems(repoRoot = DEFAULT_REPO_ROOT) {
  const catalog = discoverCatalog(repoRoot);
  const items = [];

  const addEntry = (kind, id) => {
    const filePath = getComponentFilePath(repoRoot, catalog, kind, id);
    const raw = filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const parsed = parseFrontmatter(raw);
    items.push({
      kind,
      id,
      title: parsed.title || id,
      description: parsed.description || `${kind} component: ${id}`,
      canonical: kind === 'shim' ? (catalog.shimCanonicalMap[id] || []) : [],
      hasScripts: kind === 'skill' && fs.existsSync(path.join(repoRoot, 'skills', id, 'scripts')),
    });
  };

  for (const id of catalog.skills) addEntry('skill', id);
  for (const id of catalog.agents) addEntry('agent', id);
  for (const id of catalog.commands) addEntry('command', id);
  for (const id of catalog.shims) addEntry('shim', id);

  return { catalog, items };
}

function inspectTargetStates(repoRoot, projectRoot, homeDir, env) {
  const inspectList = ['arena', 'claude-project', 'claude', 'cursor'];
  return inspectList.map(targetName => {
    const spec = resolveTargetSpec(targetName, { homeDir, projectRoot, env });
    const statePath = path.join(spec.targetRoot, spec.stateRelativePath);
    let installedCount = 0;
    let installedAt = null;
    let healthy = false;
    let selectedCounts = { skills: 0, agents: 0, commands: 0, shims: 0 };

    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        installedAt = state.installedAt || null;
        const files = state.files && typeof state.files === 'object' ? state.files : {};
        installedCount = Object.keys(files).length;
        if (state.selection) {
          selectedCounts = {
            skills: (state.selection.skills || []).length,
            agents: (state.selection.agents || []).length,
            commands: (state.selection.commands || []).length,
            shims: (state.selection.shims || []).length,
          };
        }
        healthy = installedCount > 0;
      } catch {
        healthy = false;
      }
    }

    return {
      target: targetName,
      targetRoot: path.relative(projectRoot, spec.targetRoot).startsWith('..')
        ? spec.targetRoot
        : `./${path.relative(projectRoot, spec.targetRoot)}`,
      statePath: path.relative(projectRoot, statePath).startsWith('..')
        ? statePath
        : `./${path.relative(projectRoot, statePath)}`,
      installed: healthy,
      fileCount: installedCount,
      installedAt,
      selectedCounts,
    };
  });
}

function buildTelemetrySnapshot() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPct = Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10;
  const load1 = os.loadavg()[0] || 0;
  const cpuCores = Math.max(1, os.cpus().length);
  const cpuPct = Math.min(99, Math.round(((load1 / cpuCores) * 100 + 8) * 10) / 10);
  const now = Date.now();

  const makeSeries = (points, base, variance, stepMs) => {
    const out = [];
    for (let i = points - 1; i >= 0; i -= 1) {
      const t = now - i * stepMs;
      const wave = Math.sin(t / 19000 + i * 0.55) * variance + Math.cos(i * 0.9) * (variance * 0.45);
      const val = Math.max(4, Math.min(98, Math.round((base + wave) * 10) / 10));
      out.push({ ts: t, value: val });
    }
    return out;
  };

  return {
    cpuPct,
    memPct: usedMemPct,
    freeMemGb: Math.round((freeMem / (1024 ** 3)) * 10) / 10,
    totalMemGb: Math.round((totalMem / (1024 ** 3)) * 10) / 10,
    cpuCores,
    loadAvg: os.loadavg().map(n => Math.round(n * 100) / 100),
    uptimeSec: Math.floor(process.uptime()),
    nodeVersion: process.version,
    series: {
      '1m': makeSeries(16, cpuPct + 14, 11, 4000),
      '15m': makeSeries(16, usedMemPct * 0.85, 8, 56000),
      '1h': makeSeries(16, 48, 16, 225000),
    },
  };
}

function recommendComponents(query, items) {
  const raw = String(query || '').trim().toLowerCase();
  if (!raw) {
    return {
      query: '',
      matches: items.slice(0, 6),
      command: 'ecc-install --skills blueprint,tdd-workflow,verification-loop,code-reviewer',
    };
  }

  const tokens = raw
    .split(/[\s,،؛.+/_-]+/)
    .map(t => t.trim())
    .filter(Boolean);

  const expandedTokens = new Set(tokens);
  for (const token of tokens) {
    for (const [faKey, aliases] of Object.entries(PERSIAN_INTENT_ALIASES)) {
      if (token.includes(faKey) || faKey.includes(token)) {
        for (const a of aliases) expandedTokens.add(a);
      }
    }
  }

  const scored = items.map(item => {
    const idLower = item.id.toLowerCase();
    const titleLower = item.title.toLowerCase();
    const descLower = item.description.toLowerCase();
    let score = 0;

    if (idLower === raw) score += 100;
    if (idLower.includes(raw)) score += 35;

    for (const tok of expandedTokens) {
      if (tok.length < 2) continue;
      if (idLower === tok) score += 45;
      else if (idLower.includes(tok)) score += 20;
      if (titleLower.includes(tok)) score += 12;
      if (descLower.includes(tok)) score += 6;
    }

    if (score > 0 && item.kind === 'skill') score += 4;
    return { ...item, score };
  })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 8);

  const selected = scored.length > 0 ? scored : items.filter(i => ['plan', 'tdd-workflow', 'verification-loop', 'code-reviewer'].includes(i.id));
  const ids = [...new Set(selected.map(s => s.id))];
  return {
    query,
    matches: selected,
    command: `ecc-install --skills ${ids.join(',')}`,
  };
}

function runAuditAction(repoRoot, projectRoot, homeDir, env) {
  const { catalog } = buildCatalogItems(repoRoot);
  const targets = inspectTargetStates(repoRoot, projectRoot, homeDir, env);
  const issues = [];

  for (const t of targets) {
    if (!t.installed) continue;
    const spec = resolveTargetSpec(t.target, { homeDir, projectRoot, env });
    const statePath = path.join(spec.targetRoot, spec.stateRelativePath);
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      for (const [relPath, entry] of Object.entries(state.files || {})) {
        const abs = path.join(spec.targetRoot, relPath);
        if (!fs.existsSync(abs)) {
          issues.push(`${t.target}: missing ${relPath}`);
          continue;
        }
        const hash = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
        if (hash !== entry.sha256) {
          issues.push(`${t.target}: modified ${relPath}`);
        }
      }
    } catch (err) {
      issues.push(`${t.target}: unreadable install-state (${err.message})`);
    }
  }

  return {
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    catalogCounts: {
      skills: catalog.skills.length,
      agents: catalog.agents.length,
      commands: catalog.commands.length,
      shims: catalog.shims.length,
    },
    targetsChecked: targets.filter(t => t.installed).map(t => t.target),
    issues,
  };
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON request body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let cleanPath = pathname === '/' ? '/index.html' : pathname;
  try {
    cleanPath = decodeURIComponent(cleanPath);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const candidate = path.resolve(PUBLIC_DIR, `.${cleanPath}`);
  const rel = path.relative(PUBLIC_DIR, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  let fileToServe = candidate;
  if (!fs.existsSync(fileToServe) || fs.statSync(fileToServe).isDirectory()) {
    const ext = path.extname(cleanPath);
    if (!ext) {
      fileToServe = path.join(PUBLIC_DIR, 'index.html');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
  }

  const ext = path.extname(fileToServe).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const headers = { 'Content-Type': contentType };

  if (path.basename(fileToServe) === 'sw.js') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Service-Worker-Allowed'] = '/';
  } else if (ext === '.html' || ext === '.webmanifest') {
    headers['Cache-Control'] = 'no-cache';
  } else {
    headers['Cache-Control'] = 'public, max-age=3600';
  }

  res.writeHead(200, headers);
  fs.createReadStream(fileToServe).pipe(res);
}

function createDashboardServer(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || DEFAULT_REPO_ROOT);
  const projectRoot = path.resolve(options.projectRoot || repoRoot);
  const homeDir = path.resolve(options.homeDir || os.homedir());
  const env = options.env || process.env;

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    try {
      if (req.method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, {
          ok: true,
          service: 'aether-ecc-dashboard',
          uptimeSec: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        });
      }

      if (req.method === 'GET' && pathname === '/api/status') {
        const { catalog } = buildCatalogItems(repoRoot);
        return sendJson(res, 200, {
          ok: true,
          app: {
            name: 'Aether ECC',
            version: '1.0.0',
            upstreamVersion: '2.2.3',
          },
          counts: {
            skills: catalog.skills.length,
            agents: catalog.agents.length,
            commands: catalog.commands.length,
            shims: catalog.shims.length,
            total: catalog.skills.length + catalog.agents.length + catalog.commands.length + catalog.shims.length,
          },
          targets: inspectTargetStates(repoRoot, projectRoot, homeDir, env),
          telemetry: buildTelemetrySnapshot(),
        });
      }

      if (req.method === 'GET' && pathname === '/api/catalog') {
        const { catalog, items } = buildCatalogItems(repoRoot);
        return sendJson(res, 200, {
          ok: true,
          counts: {
            skills: catalog.skills.length,
            agents: catalog.agents.length,
            commands: catalog.commands.length,
            shims: catalog.shims.length,
          },
          items,
        });
      }

      const compMatch = pathname.match(/^\/api\/component\/(skill|agent|command|shim)\/([a-zA-Z0-9._-]+)$/);
      if (req.method === 'GET' && compMatch) {
        const [, kind, id] = compMatch;
        const catalog = discoverCatalog(repoRoot);
        const filePath = getComponentFilePath(repoRoot, catalog, kind, id);
        if (!filePath || !fs.existsSync(filePath)) {
          return sendJson(res, 404, { ok: false, error: `Unknown ${kind}: ${id}` });
        }
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = parseFrontmatter(raw);
        return sendJson(res, 200, {
          ok: true,
          kind,
          id,
          title: parsed.title || id,
          description: parsed.description,
          canonical: kind === 'shim' ? (catalog.shimCanonicalMap[id] || []) : [],
          relativePath: path.relative(repoRoot, filePath),
          content: raw,
        });
      }

      if (req.method === 'POST' && pathname === '/api/recommend') {
        const body = await readJsonBody(req);
        const { items } = buildCatalogItems(repoRoot);
        return sendJson(res, 200, {
          ok: true,
          ...recommendComponents(body.query || '', items),
        });
      }

      if (req.method === 'POST' && pathname === '/api/install-preview') {
        const body = await readJsonBody(req);
        const target = body.target || 'arena';
        if (!SUPPORTED_TARGETS.includes(target)) {
          return sendJson(res, 400, { ok: false, error: `Unsupported target: ${target}` });
        }
        const skills = Array.isArray(body.skills) ? body.skills : [];
        const plan = createInstallPlan({
          repoRoot,
          projectRoot,
          homeDir,
          env,
          target,
          skills,
          includeCanonical: body.includeCanonical !== false,
          installShims: body.installShims !== false,
        });

        const result = body.apply === true ? applyInstallPlan(plan) : plan;
        return sendJson(res, 200, {
          ok: true,
          applied: body.apply === true,
          target: result.target,
          targetRoot: result.targetRoot,
          selection: result.selection,
          warnings: result.warnings,
          operationCount: result.operations.length,
          summary: result.summary || null,
          sampleOperations: result.operations.slice(0, 12).map(op => ({
            kind: op.kind,
            id: op.id,
            action: op.action,
            source: op.sourceRelativePath,
            destination: op.destinationRelativePath,
          })),
        });
      }

      if (req.method === 'POST' && pathname === '/api/action') {
        const body = await readJsonBody(req);
        const action = String(body.action || '');
        if (action === 'audit') {
          return sendJson(res, 200, runAuditAction(repoRoot, projectRoot, homeDir, env));
        }
        if (action === 'sync-arena') {
          const plan = createInstallPlan({
            repoRoot,
            projectRoot,
            homeDir,
            env,
            target: 'arena',
          });
          const applied = applyInstallPlan(plan);
          return sendJson(res, 200, {
            ok: true,
            action: 'sync-arena',
            target: applied.target,
            targetRoot: applied.targetRoot,
            summary: applied.summary,
          });
        }
        if (action === 'telemetry-pulse') {
          return sendJson(res, 200, {
            ok: true,
            telemetry: buildTelemetrySnapshot(),
          });
        }
        return sendJson(res, 400, { ok: false, error: `Unknown action: ${action}` });
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        return serveStatic(req, res, pathname);
      }

      return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const server = createDashboardServer();
  server.listen(port, host, () => {
    console.log(`Aether ECC Liquid Glass PWA listening on http://${host}:${port}`);
  });
}

module.exports = {
  buildCatalogItems,
  createDashboardServer,
  parseFrontmatter,
  recommendComponents,
};

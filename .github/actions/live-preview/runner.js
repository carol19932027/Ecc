#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const COMMENT_MARKER = '<!-- aether-live-preview -->';

function commandExists(bin) {
  try {
    execFileSync('which', [bin], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function parseTunnelUrl(chunk, provider) {
  const text = String(chunk || '');
  if (provider === 'cloudflared') {
    const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i);
    return m ? m[0] : null;
  }
  if (provider === 'localhost.run') {
    const m = text.match(/https:\/\/[a-z0-9-]+\.(?:lhr\.life|localhost\.run)\b/i);
    return m ? m[0] : null;
  }
  if (provider === 'localtunnel') {
    const m = text.match(/https:\/\/[a-z0-9-]+\.loca\.lt\b/i);
    return m ? m[0] : null;
  }
  const generic = text.match(/https:\/\/[^\s"'<>]+/i);
  return generic ? generic[0] : null;
}

function writeGitHubOutputs(outputs, outputFile = process.env.GITHUB_OUTPUT) {
  if (!outputFile) return;
  const lines = [];
  for (const [key, val] of Object.entries(outputs)) {
    const safeVal = String(val ?? '').replace(/\r?\n/g, ' ');
    lines.push(`${key}=${safeVal}`);
  }
  fs.appendFileSync(outputFile, `${lines.join('\n')}\n`, 'utf8');
}

function appendStepSummary(markdown, summaryFile = process.env.GITHUB_STEP_SUMMARY) {
  if (!summaryFile) return;
  fs.appendFileSync(summaryFile, `${markdown}\n`, 'utf8');
}

function buildPreviewSummaryMarkdown({
  url,
  provider,
  port,
  minutes,
  expiresAt,
  runUrl,
  pagesUrl,
}) {
  const lines = [
    COMMENT_MARKER,
    '## Aether ECC Live Preview',
    '',
    '| Property | Value |',
    '| --- | --- |',
    `| Status | ${url ? 'Live (Ephemeral Tunnel Active)' : 'Verified (Health Check Passed)'} |`,
    `| Live Tunnel URL | ${url ? `[${url}](${url})` : 'N/A (`provider: none`)'} |`,
    `| Provider | \`${provider}\` |`,
    `| Local Port | \`${port}\` |`,
    `| Keep-Alive Window | ${minutes > 0 ? `${minutes} minute(s) (until \`${expiresAt}\`)` : 'Immediate check only'} |`,
  ];
  if (pagesUrl) {
    lines.push(`| Static Preview | [${pagesUrl}](${pagesUrl}) |`);
  }
  if (runUrl) {
    lines.push(`| Workflow Run | [View logs & artifacts](${runUrl}) |`);
  }
  lines.push('');
  return lines.join('\n');
}

function probeLocalHttp(port, healthPath) {
  return new Promise(resolve => {
    const normalizedPath = healthPath.startsWith('/') ? healthPath : `/${healthPath}`;
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port: Number(port),
        path: normalizedPath,
        timeout: 2500,
      },
      res => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServerHealthy(port, healthPath, timeoutSec, isChildAlive) {
  const deadline = Date.now() + Math.max(2, timeoutSec) * 1000;
  while (Date.now() < deadline) {
    if (isChildAlive && !isChildAlive()) {
      throw new Error('Server process exited before passing health check');
    }
    const ok = await probeLocalHttp(port, healthPath);
    if (ok) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Timed out after ${timeoutSec}s waiting for http://127.0.0.1:${port}${healthPath}`);
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest, { mode: 0o755 });
    const request = urlStr => {
      https.get(urlStr, { headers: { 'User-Agent': 'aether-live-preview-action' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          request(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} downloading ${urlStr}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
      }).on('error', err => {
        fs.rmSync(dest, { force: true });
        reject(err);
      });
    };
    request(url);
  });
}

async function ensureCloudflaredBinary() {
  if (commandExists('cloudflared')) return 'cloudflared';
  const cached = path.join(os.tmpdir(), 'cloudflared-bin');
  if (fs.existsSync(cached)) return cached;
  if (process.platform !== 'linux') {
    throw new Error('cloudflared binary is not installed on this runner');
  }
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const dlUrl = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}`;
  console.log(`[live-preview] Downloading cloudflared from ${dlUrl}...`);
  await downloadFile(dlUrl, cached);
  fs.chmodSync(cached, 0o755);
  return cached;
}

async function startSingleTunnelProvider(provider, port, timeoutMs = 25000) {
  let cmd;
  let args;

  if (provider === 'cloudflared') {
    cmd = await ensureCloudflaredBinary();
    args = ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`];
  } else if (provider === 'localhost.run') {
    if (!commandExists('ssh')) throw new Error('ssh not available for localhost.run');
    cmd = 'ssh';
    args = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'ServerAliveInterval=30',
      '-o', 'ExitOnForwardFailure=yes',
      '-R', `80:127.0.0.1:${port}`,
      'nokey@localhost.run',
    ];
  } else if (provider === 'localtunnel') {
    cmd = 'npx';
    args = ['--yes', 'localtunnel', '--port', String(port)];
  } else {
    throw new Error(`Unsupported tunnel provider: ${provider}`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    let settled = false;
    let logs = '';
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      killProcessTree(child);
      reject(new Error(`${provider} did not emit a public URL within ${timeoutMs / 1000}s.\nLogs:\n${logs.slice(-600)}`));
    }, timeoutMs);

    const onChunk = buf => {
      const text = buf.toString();
      logs += text;
      const found = parseTunnelUrl(text, provider);
      if (found && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ url: found, provider, process: child });
      }
    };

    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    child.on('error', err => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    child.on('exit', code => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`${provider} exited early with code ${code}.\nLogs:\n${logs.slice(-600)}`));
      }
    });
  });
}

async function openTunnel(preferredProvider, port) {
  const pref = String(preferredProvider || 'auto').toLowerCase();
  if (pref === 'none') {
    return { url: '', provider: 'none', process: null };
  }

  const order = pref === 'auto'
    ? ['cloudflared', 'localhost.run', 'localtunnel']
    : [pref];

  const errors = [];
  for (const prov of order) {
    try {
      console.log(`[live-preview] Opening tunnel via ${prov}...`);
      const result = await startSingleTunnelProvider(prov, port);
      console.log(`[live-preview] Tunnel ready (${prov}): ${result.url}`);
      return result;
    } catch (err) {
      console.warn(`[live-preview] ${prov} unavailable: ${err.message}`);
      errors.push(`${prov}: ${err.message}`);
    }
  }
  throw new Error(`All tunnel providers failed:\n${errors.join('\n')}`);
}

function killProcessTree(child) {
  if (!child || !child.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // Ignore already-exited child
    }
  }
}

async function postJson(urlStr, body, headers = {}) {
  const res = await fetch(urlStr, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${urlStr}: ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

async function notifyDiscord(webhookUrl, { url, provider, expiresAt, repo, runUrl }) {
  if (!webhookUrl) return;
  const content = [
    `**Aether ECC Live Preview Ready** (${repo || 'repository'})`,
    url ? `URL: ${url}` : 'Server health check passed (no external tunnel)',
    `Provider: \`${provider}\``,
    expiresAt ? `Active until: \`${expiresAt}\`` : '',
    runUrl ? `Run: ${runUrl}` : '',
  ].filter(Boolean).join('\n');

  await postJson(webhookUrl, { content });
  console.log('[live-preview] Posted notification to Discord webhook.');
}

async function upsertPrComment({ token, repo, prNumber, body }) {
  if (!token || !repo || !prNumber) return;
  const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'aether-live-preview-action',
  };

  const listRes = await fetch(`${apiBase}/repos/${repo}/issues/${prNumber}/comments?per_page=50`, { headers });
  if (!listRes.ok) {
    throw new Error(`Failed to list PR comments (${listRes.status})`);
  }
  const comments = await listRes.json();
  const existing = Array.isArray(comments)
    ? comments.find(c => typeof c.body === 'string' && c.body.includes(COMMENT_MARKER))
    : null;

  if (existing) {
    const patchRes = await fetch(`${apiBase}/repos/${repo}/issues/comments/${existing.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!patchRes.ok) throw new Error(`Failed to update PR comment (${patchRes.status})`);
    console.log(`[live-preview] Updated sticky PR #${prNumber} comment.`);
    return;
  }

  await postJson(`${apiBase}/repos/${repo}/issues/${prNumber}/comments`, { body }, headers);
  console.log(`[live-preview] Created PR #${prNumber} comment.`);
}

function readPrNumberFromEvent(eventPath = process.env.GITHUB_EVENT_PATH) {
  if (!eventPath || !fs.existsSync(eventPath)) return null;
  try {
    const evt = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    return evt?.pull_request?.number || evt?.issue?.number || null;
  } catch {
    return null;
  }
}

async function runLivePreview(env = process.env) {
  const port = Number(env.INPUT_PORT || 3000);
  const command = String(env.INPUT_COMMAND || 'npm run dashboard').trim();
  const minutes = Math.max(0, Math.min(60, Number(env.INPUT_MINUTES ?? 15)));
  const providerPref = String(env.INPUT_PROVIDER || 'auto').trim();
  const healthPath = String(env.INPUT_HEALTH_PATH || '/api/health').trim();
  const startupTimeout = Number(env.INPUT_STARTUP_TIMEOUT || 30);
  const discordUrl = String(env.INPUT_DISCORD_WEBHOOK_URL || '').trim();
  const commentOnPr = String(env.INPUT_COMMENT_ON_PR || 'true').toLowerCase() === 'true';

  console.log(`[live-preview] Starting server on port ${port}: ${command}`);
  const serverChild = spawn(command, {
    shell: true,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...env, PORT: String(port), HOST: '0.0.0.0' },
  });

  let serverAlive = true;
  serverChild.on('exit', () => {
    serverAlive = false;
  });
  serverChild.stdout.on('data', d => process.stdout.write(`[server] ${d}`));
  serverChild.stderr.on('data', d => process.stderr.write(`[server] ${d}`));

  let tunnelChild = null;
  const cleanup = () => {
    killProcessTree(tunnelChild);
    killProcessTree(serverChild);
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  try {
    await waitForServerHealthy(port, healthPath, startupTimeout, () => serverAlive);
    console.log(`[live-preview] Local server healthy at http://127.0.0.1:${port}${healthPath}`);

    const tunnel = await openTunnel(providerPref, port);
    tunnelChild = tunnel.process;

    const expiresAt = minutes > 0
      ? new Date(Date.now() + minutes * 60 * 1000).toISOString()
      : new Date().toISOString();

    const repo = env.GITHUB_REPOSITORY || '';
    const serverUrl = env.GITHUB_SERVER_URL || 'https://github.com';
    const runId = env.GITHUB_RUN_ID || '';
    const runUrl = repo && runId ? `${serverUrl}/${repo}/actions/runs/${runId}` : '';

    let pagesUrl = '';
    if (repo.includes('/')) {
      const [owner, name] = repo.split('/');
      pagesUrl = `https://${owner}.github.io/${name}/`;
    }

    writeGitHubOutputs({
      url: tunnel.url,
      provider: tunnel.provider,
      expires_at: expiresAt,
    }, env.GITHUB_OUTPUT);

    const summaryMd = buildPreviewSummaryMarkdown({
      url: tunnel.url,
      provider: tunnel.provider,
      port,
      minutes,
      expiresAt,
      runUrl,
      pagesUrl,
    });
    appendStepSummary(summaryMd, env.GITHUB_STEP_SUMMARY);

    if (tunnel.url && env.GITHUB_ACTIONS === 'true') {
      console.log(`::notice title=Aether Live Preview Ready::${tunnel.url} (provider: ${tunnel.provider}, expires: ${expiresAt})`);
    }

    if (discordUrl) {
      await notifyDiscord(discordUrl, {
        url: tunnel.url,
        provider: tunnel.provider,
        expiresAt,
        repo,
        runUrl,
      }).catch(err => console.warn(`[live-preview] Discord notice skipped: ${err.message}`));
    }

    if (commentOnPr && tunnel.url) {
      const prNumber = readPrNumberFromEvent(env.GITHUB_EVENT_PATH);
      if (prNumber && env.GITHUB_TOKEN && repo) {
        await upsertPrComment({
          token: env.GITHUB_TOKEN,
          repo,
          prNumber,
          body: summaryMd,
        }).catch(err => console.warn(`[live-preview] PR comment skipped: ${err.message}`));
      }
    }

    if (minutes > 0 && tunnel.url) {
      console.log(`[live-preview] Holding live preview open for ${minutes} minute(s) until ${expiresAt}...`);
      await new Promise(resolve => setTimeout(resolve, minutes * 60 * 1000));
    }
  } finally {
    cleanup();
  }
}

if (require.main === module) {
  runLivePreview().catch(err => {
    console.error(`[live-preview] Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  COMMENT_MARKER,
  appendStepSummary,
  buildPreviewSummaryMarkdown,
  parseTunnelUrl,
  probeLocalHttp,
  readPrNumberFromEvent,
  runLivePreview,
  waitForServerHealthy,
  writeGitHubOutputs,
};

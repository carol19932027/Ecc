#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { DEFAULT_REPO_ROOT } = require('../../lib/ecc-installer');
const {
  buildCatalogItems,
  buildTelemetrySnapshot,
  getComponentFilePath,
  parseFrontmatter,
} = require('../server');

const PUBLIC_DIR = path.resolve(__dirname, '../public');

function copyDirRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rewriteForSubpathHosting(outDir) {
  const indexPath = path.join(outDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html
    .replaceAll('href="/manifest.webmanifest"', 'href="./manifest.webmanifest"')
    .replaceAll('href="/icons/', 'href="./icons/')
    .replaceAll('href="/styles.css', 'href="./styles.css')
    .replaceAll('src="/app.js', 'src="./app.js');
  fs.writeFileSync(indexPath, html, 'utf8');
  fs.copyFileSync(indexPath, path.join(outDir, '404.html'));

  const manifestPath = path.join(outDir, 'manifest.webmanifest');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.id = './?source=pwa';
    manifest.start_url = './?source=pwa';
    manifest.scope = './';
    for (const icon of manifest.icons || []) {
      if (typeof icon.src === 'string' && icon.src.startsWith('/')) {
        icon.src = `.${icon.src}`;
      }
    }
    for (const sc of manifest.shortcuts || []) {
      if (typeof sc.url === 'string' && sc.url.startsWith('/')) {
        sc.url = `.${sc.url}`;
      }
      for (const icon of sc.icons || []) {
        if (typeof icon.src === 'string' && icon.src.startsWith('/')) {
          icon.src = `.${icon.src}`;
        }
      }
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
}

function buildStaticPreview(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || DEFAULT_REPO_ROOT);
  const outDir = path.resolve(options.outDir || path.join(repoRoot, 'dist-preview'));

  fs.rmSync(outDir, { recursive: true, force: true });
  copyDirRecursive(PUBLIC_DIR, outDir);
  rewriteForSubpathHosting(outDir);

  const { catalog, items } = buildCatalogItems(repoRoot);
  const components = {};
  for (const item of items) {
    const filePath = getComponentFilePath(repoRoot, catalog, item.kind, item.id);
    const raw = filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    const parsed = parseFrontmatter(raw);
    components[`${item.kind}/${item.id}`] = {
      ok: true,
      kind: item.kind,
      id: item.id,
      title: parsed.title || item.id,
      description: parsed.description || item.description,
      canonical: item.canonical || [],
      relativePath: filePath ? path.relative(repoRoot, filePath) : '',
      content: raw,
    };
  }

  const readTargetState = (targetName, relRoot, stateFile) => {
    const absState = path.join(repoRoot, stateFile);
    if (!fs.existsSync(absState)) {
      return { target: targetName, targetRoot: relRoot, installed: false, fileCount: 0 };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(absState, 'utf8'));
      const count = Object.keys(parsed.files || {}).length;
      return { target: targetName, targetRoot: relRoot, installed: count > 0, fileCount: count };
    } catch {
      return { target: targetName, targetRoot: relRoot, installed: false, fileCount: 0 };
    }
  };

  const telemetry = buildTelemetrySnapshot();
  const targets = [
    readTargetState('arena', './.agents', '.agents/ecc-curated-state.json'),
    readTargetState('claude-project', './.claude', '.claude/ecc-curated-state.json'),
    { target: 'claude', targetRoot: '~/.claude', installed: false, fileCount: 0 },
    { target: 'cursor', targetRoot: './.cursor', installed: false, fileCount: 0 },
  ];

  const bundle = {
    ok: true,
    previewMode: 'static-pages',
    generatedAt: new Date().toISOString(),
    status: {
      ok: true,
      app: { name: 'Aether ECC', version: '1.0.0', upstreamVersion: '2.2.3' },
      counts: {
        skills: catalog.skills.length,
        agents: catalog.agents.length,
        commands: catalog.commands.length,
        shims: catalog.shims.length,
        total: items.length,
      },
      targets,
      telemetry,
    },
    catalog: {
      ok: true,
      counts: {
        skills: catalog.skills.length,
        agents: catalog.agents.length,
        commands: catalog.commands.length,
        shims: catalog.shims.length,
      },
      items,
    },
    components,
  };

  const previewDataDir = path.join(outDir, 'preview-data');
  fs.mkdirSync(previewDataDir, { recursive: true });
  fs.writeFileSync(path.join(previewDataDir, 'bundle.json'), JSON.stringify(bundle), 'utf8');
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '', 'utf8');

  return {
    outDir,
    componentCount: items.length,
    bundleBytes: Buffer.byteLength(JSON.stringify(bundle)),
    generatedAt: bundle.generatedAt,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let outDir;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--out' && args[i + 1]) {
      outDir = args[i + 1];
      i += 1;
    }
  }
  const result = buildStaticPreview({ outDir });
  console.log(`Built Aether ECC static live preview in ${result.outDir} (${result.componentCount} components, ${(result.bundleBytes / 1024).toFixed(1)} KB bundle)`);
}

module.exports = {
  buildStaticPreview,
};

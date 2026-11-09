'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { PassThrough } = require('node:stream');

const {
  CANONICAL_ALL_TARGETS,
  DEFAULT_REPO_ROOT,
  GUIDED_PROFILES,
  applyGuidedPlan,
  applyInstallPlan,
  createGuidedPlan,
  createInstallPlan,
  discoverCatalog,
  getGuidedProfile,
  listGuidedProfiles,
  parseArgs,
  resolveTargetSpec,
  uninstallFromTarget,
} = require('../lib/ecc-installer');
const { runGuidedInstall } = require('../lib/guided-wizard');

const USER_REQUESTED_63 = [
  'agent-harness-construction',
  'api-design',
  'architect',
  'autonomous-loops',
  'blueprint',
  'build-error-resolver',
  'build-fix',
  'checkpoint',
  'code-review',
  'code-reviewer',
  'coding-standards',
  'configure-ecc',
  'continuous-agent-loop',
  'continuous-learning',
  'continuous-learning-v2',
  'database-migrations',
  'deployment-patterns',
  'doc-updater',
  'e2e',
  'e2e-runner',
  'eval',
  'eval-harness',
  'evolve',
  'frontend-patterns',
  'harness-audit',
  'harness-optimizer',
  'instinct-export',
  'instinct-import',
  'instinct-status',
  'learn',
  'learn-eval',
  'liquid-glass-design',
  'loop-operator',
  'loop-start',
  'loop-status',
  'model-route',
  'multi-backend',
  'multi-execute',
  'multi-frontend',
  'multi-plan',
  'multi-workflow',
  'orchestrate',
  'plan',
  'planner',
  'projects',
  'promote',
  'prompt-optimize',
  'prompt-optimizer',
  'refactor-clean',
  'refactor-cleaner',
  'resume-session',
  'save-session',
  'sessions',
  'setup-pm',
  'skill-create',
  'strategic-compact',
  'tdd',
  'tdd-workflow',
  'test-coverage',
  'update-codemaps',
  'update-docs',
  'verification-loop',
  'verify',
];

function makeTempDir(prefix = 'ecc-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('discoverCatalog exposes expected skills, agents, commands, and shims', () => {
  const catalog = discoverCatalog(DEFAULT_REPO_ROOT);
  assert.equal(catalog.skills.length, 21);
  assert.equal(catalog.agents.length, 9);
  assert.equal(catalog.commands.length, 30);
  assert.equal(catalog.shims.length, 6);
  assert.deepEqual(catalog.shimCanonicalMap.e2e, ['e2e-testing']);
  assert.deepEqual(catalog.shimCanonicalMap.orchestrate, ['dmux-workflows', 'autonomous-agent-harness']);
});

test('63-item --skills list resolves into skills (with canonical additions), agents, commands, and shims', () => {
  const tmpHome = makeTempDir();
  try {
    const plan = createInstallPlan({
      homeDir: tmpHome,
      projectRoot: tmpHome,
      skills: USER_REQUESTED_63,
    });

    assert.equal(plan.target, 'claude');
    assert.equal(plan.targetRoot, path.join(tmpHome, '.claude'));
    assert.equal(plan.selection.skills.length, 21);
    assert.equal(plan.selection.agents.length, 9);
    assert.equal(plan.selection.commands.length, 30);
    assert.equal(plan.selection.shims.length, 6);
    assert.ok(plan.selection.skills.includes('e2e-testing'));
    assert.ok(plan.selection.skills.includes('dmux-workflows'));
    assert.ok(plan.selection.skills.includes('autonomous-agent-harness'));
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('--no-canonical and --no-shims control shim resolution', () => {
  const tmpHome = makeTempDir();
  try {
    const noCanonical = createInstallPlan({
      homeDir: tmpHome,
      projectRoot: tmpHome,
      skills: USER_REQUESTED_63,
      includeCanonical: false,
    });
    assert.equal(noCanonical.selection.skills.length, 18);
    assert.equal(noCanonical.selection.skills.includes('e2e-testing'), false);
    assert.equal(noCanonical.selection.skills.includes('eval-harness'), true);
    assert.equal(noCanonical.selection.shims.length, 6);

    const noShims = createInstallPlan({
      homeDir: tmpHome,
      projectRoot: tmpHome,
      skills: ['e2e', 'orchestrate'],
      installShims: false,
    });
    assert.deepEqual(noShims.selection.shims, []);
    assert.deepEqual(noShims.selection.skills, ['autonomous-agent-harness', 'dmux-workflows', 'e2e-testing']);
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('--without excludes bare and family-prefixed components', () => {
  const tmpHome = makeTempDir();
  try {
    const plan = createInstallPlan({
      homeDir: tmpHome,
      projectRoot: tmpHome,
      skills: ['api-design', 'architect', 'build-fix', 'e2e'],
      withoutComponents: ['architect', 'skill:e2e-testing', 'command:build-fix'],
    });
    assert.deepEqual(plan.selection.skills, ['api-design']);
    assert.deepEqual(plan.selection.agents, []);
    assert.deepEqual(plan.selection.commands, []);
    assert.deepEqual(plan.selection.shims, ['e2e']);
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('config-driven mode installs full curated selection from ecc-install.json', () => {
  const tmpHome = makeTempDir();
  try {
    const plan = createInstallPlan({
      homeDir: tmpHome,
      projectRoot: DEFAULT_REPO_ROOT,
    });
    assert.equal(plan.mode, 'config');
    assert.equal(plan.selection.skills.length, 21);
    assert.equal(plan.selection.agents.length, 9);
    assert.equal(plan.selection.commands.length, 30);
    assert.equal(plan.selection.shims.length, 6);
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

test('target specs resolve paths accurately across supported targets', () => {
  const homeDir = '/tmp/fake-home';
  const projectRoot = '/tmp/fake-proj';

  assert.equal(
    resolveTargetSpec('claude', { homeDir, projectRoot, env: {} }).targetRoot,
    path.join(homeDir, '.claude')
  );
  assert.equal(
    resolveTargetSpec('claude', { homeDir, projectRoot, env: { CLAUDE_CONFIG_DIR: '~/custom-claude' } }).targetRoot,
    path.join(homeDir, 'custom-claude')
  );
  assert.equal(
    resolveTargetSpec('claude-project', { homeDir, projectRoot, env: {} }).targetRoot,
    path.join(projectRoot, '.claude')
  );
  const arena = resolveTargetSpec('arena', { homeDir, projectRoot, env: {} });
  assert.equal(arena.targetRoot, path.join(projectRoot, '.agents'));
  assert.equal(arena.commandsSubdir, 'workflows');
  const antigravity = resolveTargetSpec('antigravity', { homeDir, projectRoot, env: {} });
  assert.equal(antigravity.targetRoot, path.join(projectRoot, '.agents'));
  assert.equal(antigravity.commandsSubdir, 'workflows');
  assert.equal(
    resolveTargetSpec('opencode', { homeDir, projectRoot, env: { XDG_CONFIG_HOME: '/tmp/xdg' } }).targetRoot,
    '/tmp/xdg/opencode'
  );
});

test('applyInstallPlan writes files, preserves permissions, guards conflicts, and uninstalls cleanly', () => {
  const tmpDir = makeTempDir();
  try {
    const projectDir = path.join(tmpDir, 'proj');
    fs.mkdirSync(projectDir, { recursive: true });

    // Pre-create an unmanaged conflicting file
    const conflictPath = path.join(projectDir, '.claude', 'agents', 'architect.md');
    fs.mkdirSync(path.dirname(conflictPath), { recursive: true });
    fs.writeFileSync(conflictPath, 'user customized architect\n', 'utf8');

    const plan = createInstallPlan({
      homeDir: tmpDir,
      projectRoot: projectDir,
      target: 'claude-project',
      skills: ['architect', 'continuous-learning-v2', 'build-fix', 'e2e'],
    });
    const first = applyInstallPlan(plan);
    assert.equal(first.summary.skipped, 1);
    assert.equal(fs.readFileSync(conflictPath, 'utf8'), 'user customized architect\n');

    // Verify executable bit preserved on shell hook script
    const hookScript = path.join(projectDir, '.claude', 'skills', 'continuous-learning-v2', 'hooks', 'observe.sh');
    assert.ok(fs.existsSync(hookScript));
    assert.ok((fs.statSync(hookScript).mode & 0o111) !== 0);

    // Re-run without --force -> unchanged + still skipped
    const second = applyInstallPlan(createInstallPlan({
      homeDir: tmpDir,
      projectRoot: projectDir,
      target: 'claude-project',
      skills: ['architect', 'continuous-learning-v2', 'build-fix', 'e2e'],
    }));
    assert.equal(second.summary.created, 0);
    assert.equal(second.summary.skipped, 1);
    assert.ok(second.summary.unchanged > 0);

    // Re-run with --force -> updates conflictPath
    const forced = applyInstallPlan(createInstallPlan({
      homeDir: tmpDir,
      projectRoot: projectDir,
      target: 'claude-project',
      skills: ['architect', 'continuous-learning-v2', 'build-fix', 'e2e'],
      force: true,
    }));
    assert.equal(forced.summary.updated, 1);
    assert.notEqual(fs.readFileSync(conflictPath, 'utf8'), 'user customized architect\n');

    // Modify one managed file before uninstall to test preservation
    const buildFixDest = path.join(projectDir, '.claude', 'commands', 'build-fix.md');
    fs.writeFileSync(buildFixDest, 'user modified command\n', 'utf8');

    const uninstalled = uninstallFromTarget({
      homeDir: tmpDir,
      projectRoot: projectDir,
      target: 'claude-project',
    });
    assert.ok(uninstalled.preserved.includes(buildFixDest));
    assert.ok(!fs.existsSync(hookScript));
    assert.ok(fs.existsSync(buildFixDest));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('antigravity target installs commands and shims into workflows/', () => {
  const tmpDir = makeTempDir();
  try {
    const plan = createInstallPlan({
      homeDir: tmpDir,
      projectRoot: tmpDir,
      target: 'antigravity',
      skills: ['api-design', 'plan', 'tdd'],
    });
    const res = applyInstallPlan(plan);
    assert.ok(res.summary.created >= 4);
    assert.ok(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'api-design', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'tdd-workflow', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.agents', 'workflows', 'plan.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.agents', 'workflows', 'tdd.md')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('parseArgs rejects empty values and unexpected arguments', () => {
  assert.throws(() => parseArgs(['node', 'ecc-install', '--skills', '']), /Missing component IDs/);
  assert.throws(() => parseArgs(['node', 'ecc-install', '--target']), /Missing value/);
  assert.throws(() => parseArgs(['node', 'ecc-install', '--bogus']), /Unknown option/);
  assert.throws(() => parseArgs(['node', 'ecc-install', 'typescript']), /Unexpected positional/);
});

test('CLI supports --list --json, --dry-run --json, and rejects unknown or unsafe IDs', () => {
  const binPath = path.join(DEFAULT_REPO_ROOT, 'bin', 'ecc-install.js');

  const listOut = execFileSync(process.execPath, [binPath, '--list', '--json'], { encoding: 'utf8' });
  const listJson = JSON.parse(listOut);
  assert.equal(listJson.skills.length, 21);
  assert.equal(listJson.agents.length, 9);
  assert.equal(listJson.commands.length, 30);

  const tmpHome = makeTempDir();
  try {
    const dryOut = execFileSync(
      process.execPath,
      [binPath, '--dry-run', '--json', '--skills', USER_REQUESTED_63.join(',')],
      {
        encoding: 'utf8',
        env: { ...process.env, HOME: tmpHome, CLAUDE_CONFIG_DIR: '' },
      }
    );
    const dryJson = JSON.parse(dryOut);
    assert.equal(dryJson.dryRun, true);
    assert.equal(dryJson.plan.selection.skills.length, 21);
    assert.equal(dryJson.plan.selection.agents.length, 9);
    assert.equal(dryJson.plan.selection.commands.length, 30);
    assert.equal(dryJson.plan.selection.shims.length, 6);
    assert.equal(fs.existsSync(path.join(tmpHome, '.claude')), false);
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }

  assert.throws(
    () => execFileSync(process.execPath, [binPath, '--skills', '../evil'], { stdio: 'pipe' }),
    (err) => err.status === 1 && /Invalid component id/.test(err.stderr.toString())
  );
});

test('parseArgs parses guided flags, multi-targets, aliases, and profiles', () => {
  const parsed = parseArgs([
    'node', 'ecc-install',
    '-g',
    '--targets', 'arena,cursor',
    '--harness', 'gemini',
    '--profile=core',
    '-y',
  ]);
  assert.equal(parsed.guided, true);
  assert.deepEqual(parsed.targets, ['arena', 'cursor', 'gemini']);
  assert.equal(parsed.target, 'gemini');
  assert.equal(parsed.profile, 'core');
  assert.equal(parsed.yes, true);

  const allTargetsParsed = parseArgs(['node', 'ecc-install', '--guided', '--all-harnesses', '--dry-run']);
  assert.equal(allTargetsParsed.allTargets, true);
  assert.equal(allTargetsParsed.dryRun, true);

  const targetAllParsed = parseArgs(['node', 'ecc-install', '--guided', '--targets', 'all', '--yes']);
  assert.equal(targetAllParsed.allTargets, true);
  assert.deepEqual(targetAllParsed.targets, []);

  assert.throws(() => parseArgs(['node', 'ecc-install', '--targets', '']), /Missing target name/);
  assert.throws(() => parseArgs(['node', 'ecc-install', '--profile', '']), /Missing value/);
});

test('guided profiles match real repository components cleanly', () => {
  const catalog = discoverCatalog(DEFAULT_REPO_ROOT);
  const profiles = listGuidedProfiles(catalog);
  assert.deepEqual(profiles.map(p => p.id), ['full', 'core', 'agentic', 'frontend', 'devops', 'custom']);

  for (const id of ['core', 'agentic', 'frontend', 'devops']) {
    const def = GUIDED_PROFILES[id];
    const resolved = getGuidedProfile(id, catalog);
    assert.deepEqual(resolved.skills, def.skills);
    assert.deepEqual(resolved.agents, def.agents);
    assert.deepEqual(resolved.commands, def.commands);
    assert.deepEqual(resolved.shims, def.shims);
  }

  assert.throws(() => getGuidedProfile('nonexistent', catalog), /Unknown profile/);
});

test('createGuidedPlan deduplicates shared roots and applyGuidedPlan installs across all targets', () => {
  const tmpDir = makeTempDir();
  const fakeHome = path.join(tmpDir, 'home');
  const fakeProject = path.join(tmpDir, 'project');
  fs.mkdirSync(fakeHome, { recursive: true });
  fs.mkdirSync(fakeProject, { recursive: true });

  try {
    const sharedPlan = createGuidedPlan({
      homeDir: fakeHome,
      projectRoot: fakeProject,
      targets: ['arena', 'antigravity', 'cursor'],
      profile: 'frontend',
    });
    assert.equal(sharedPlan.targetPlans.length, 2);
    assert.deepEqual(sharedPlan.targetPlans[0].aliases, ['antigravity']);
    assert.equal(sharedPlan.targetPlans[1].target, 'cursor');

    const allPlan = createGuidedPlan({
      homeDir: fakeHome,
      projectRoot: fakeProject,
      env: {},
      allTargets: true,
      profile: 'core',
    });
    assert.equal(allPlan.targetPlans.length, CANONICAL_ALL_TARGETS.length);

    const applied = applyGuidedPlan(allPlan);
    assert.equal(applied.summary.targets, CANONICAL_ALL_TARGETS.length);
    assert.ok(fs.existsSync(path.join(fakeProject, '.agents', 'skills', 'blueprint', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(fakeProject, '.claude', 'skills', 'blueprint', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(fakeHome, '.claude', 'skills', 'blueprint', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(fakeProject, '.cursor', 'skills', 'blueprint', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(fakeHome, '.codex', 'skills', 'blueprint', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(fakeHome, '.config', 'opencode', 'skills', 'blueprint', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(fakeProject, '.gemini', 'skills', 'blueprint', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(fakeProject, '.kimi-code', 'skills', 'blueprint', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(fakeProject, '.github', 'skills', 'blueprint', 'SKILL.md')));

    // When homeDir === projectRoot, claude and claude-project share .claude and deduplicate safely
    const sameRootPlan = createGuidedPlan({
      homeDir: tmpDir,
      projectRoot: tmpDir,
      env: {},
      allTargets: true,
      profile: 'core',
    });
    assert.equal(sameRootPlan.targetPlans.length, CANONICAL_ALL_TARGETS.length - 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI --guided enforces non-interactive safety flags and supports multi-target dry-run & apply', () => {
  const binPath = path.join(DEFAULT_REPO_ROOT, 'bin', 'ecc-install.js');
  const tmpDir = makeTempDir();
  try {
    assert.throws(
      () => execFileSync(process.execPath, [binPath, '--guided'], { stdio: 'pipe' }),
      (err) => err.status === 1 && /requires at least one target/.test(err.stderr.toString())
    );

    assert.throws(
      () => execFileSync(process.execPath, [binPath, '--guided', '--target', 'arena'], { stdio: 'pipe' }),
      (err) => err.status === 1 && /requires --yes \(-y\)/.test(err.stderr.toString())
    );

    const previewOut = execFileSync(
      process.execPath,
      [binPath, '--guided', '--targets', 'arena,cursor', '--profile', 'core', '--dry-run', '--json'],
      { cwd: tmpDir, encoding: 'utf8', env: { ...process.env, HOME: tmpDir } }
    );
    const previewJson = JSON.parse(previewOut);
    assert.equal(previewJson.dryRun, true);
    assert.equal(previewJson.guidedPlan.profile, 'core');
    assert.deepEqual(previewJson.guidedPlan.targets, ['arena', 'cursor']);
    assert.equal(fs.existsSync(path.join(tmpDir, '.agents')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.cursor')), false);

    const applyOut = execFileSync(
      process.execPath,
      [binPath, '--guided', '--targets', 'arena,claude-project,gemini', '--profile', 'frontend', '--yes', '--json'],
      { cwd: tmpDir, encoding: 'utf8', env: { ...process.env, HOME: tmpDir } }
    );
    const applyJson = JSON.parse(applyOut);
    assert.equal(applyJson.dryRun, false);
    assert.equal(applyJson.result.summary.targets, 3);
    assert.ok(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'liquid-glass-design', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.agents', 'ecc-curated-state.json')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.claude', 'ecc', 'curated-state.json')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.gemini', 'ecc-curated-state.json')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('interactive guided wizard prompts, validates retries, handles cancel, and installs multi-target', async () => {
  const tmpDir = makeTempDir();
  try {
    function makePromptRunner(answers) {
      let idx = 0;
      return async () => {
        if (idx >= answers.length) {
          throw new Error('Unexpected extra wizard prompt');
        }
        const next = answers[idx];
        idx += 1;
        return next;
      };
    }

    function captureStream() {
      const chunks = [];
      const stream = new PassThrough();
      stream.on('data', c => chunks.push(c.toString('utf8')));
      return { stream, text: () => chunks.join('') };
    }

    // Cancel path: custom profile with invalid input retry, '?' help, valid selection, then cancel at confirmation
    const outCancel = captureStream();
    const errCancel = captureStream();
    const cancelRes = await runGuidedInstall(
      parseArgs(['node', 'ecc-install', '--guided']),
      {
        repoRoot: DEFAULT_REPO_ROOT,
        projectRoot: tmpDir,
        homeDir: tmpDir,
        env: {},
        isTTY: true,
        useColor: false,
        stdin: new PassThrough(),
        stdout: outCancel.stream,
        stderr: errCancel.stream,
        ask: makePromptRunner([
          'bogus',       // invalid target -> retry
          '3,5',         // arena + cursor
          'custom',      // step 2: custom profile
          '?',           // print catalog help
          'no-such-id',  // invalid component -> retry
          'api-design,plan,tdd',
          'n',           // exclude shims
          'n',           // do not force overwrite
          'n',           // cancel install
        ]),
      }
    );
    assert.equal(cancelRes.status, 'cancelled');
    assert.ok(outCancel.text().includes('Unknown target "bogus"'));
    assert.ok(outCancel.text().includes('Installation cancelled'));
    assert.equal(fs.existsSync(path.join(tmpDir, '.agents')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.cursor')), false);

    // Confirm path: install frontend profile into arena & kimi
    const outApply = captureStream();
    const errApply = captureStream();
    const applyRes = await runGuidedInstall(
      parseArgs(['node', 'ecc-install', '--guided']),
      {
        repoRoot: DEFAULT_REPO_ROOT,
        projectRoot: tmpDir,
        homeDir: tmpDir,
        env: {},
        isTTY: true,
        useColor: false,
        stdin: new PassThrough(),
        stdout: outApply.stream,
        stderr: errApply.stream,
        ask: makePromptRunner([
          'arena,kimi',
          '4',   // frontend
          'y',   // include shims
          'n',   // no force
          'y',   // confirm!
        ]),
      }
    );
    assert.equal(applyRes.status, 'applied');
    assert.equal(applyRes.result.summary.targets, 2);
    assert.ok(outApply.text().includes('ECC Guided Install Complete'));
    assert.ok(fs.existsSync(path.join(tmpDir, '.agents', 'skills', 'liquid-glass-design', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.kimi-code', 'skills', 'liquid-glass-design', 'SKILL.md')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

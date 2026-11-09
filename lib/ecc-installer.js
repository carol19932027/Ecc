'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SHIM_CANONICAL_MAP = Object.freeze({
  e2e: ['e2e-testing'],
  eval: ['eval-harness'],
  orchestrate: ['dmux-workflows', 'autonomous-agent-harness'],
  'prompt-optimize': ['prompt-optimizer'],
  tdd: ['tdd-workflow'],
  verify: ['verification-loop'],
});

const IGNORED_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db']);
const IGNORED_DIR_NAMES = new Set(['__pycache__', '.pytest_cache', 'node_modules']);
const SAFE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const SUPPORTED_TARGETS = Object.freeze([
  'claude',
  'claude-project',
  'arena',
  'antigravity',
  'cursor',
  'codex',
  'opencode',
  'gemini',
  'kimi',
  'copilot',
]);

const CANONICAL_ALL_TARGETS = Object.freeze([
  'arena',
  'claude-project',
  'claude',
  'cursor',
  'codex',
  'opencode',
  'gemini',
  'kimi',
  'copilot',
]);

const TARGET_METADATA = Object.freeze({
  arena: {
    label: 'Arena',
    locationHint: './.agents/',
    description: 'Arena & cross-agent skills, agents, and workflows',
  },
  'claude-project': {
    label: 'Claude Project',
    locationHint: './.claude/',
    description: 'Claude Code project-scoped skills, agents, and commands',
  },
  claude: {
    label: 'Claude User',
    locationHint: '~/.claude/',
    description: 'Claude Code user-global directory ($CLAUDE_CONFIG_DIR or ~/.claude/)',
  },
  antigravity: {
    label: 'Antigravity',
    locationHint: './.agents/',
    description: 'Antigravity skills, agents, and workflows (shares ./.agents/ with Arena)',
  },
  cursor: {
    label: 'Cursor',
    locationHint: './.cursor/',
    description: 'Cursor IDE project directory',
  },
  codex: {
    label: 'Codex',
    locationHint: '~/.codex/',
    description: 'OpenAI Codex user-global directory',
  },
  opencode: {
    label: 'OpenCode',
    locationHint: '~/.config/opencode/',
    description: 'OpenCode config directory ($OPENCODE_CONFIG_DIR or XDG config)',
  },
  gemini: {
    label: 'Gemini CLI',
    locationHint: './.gemini/',
    description: 'Gemini CLI project directory',
  },
  kimi: {
    label: 'Kimi Code',
    locationHint: './.kimi-code/',
    description: 'Kimi Code project directory',
  },
  copilot: {
    label: 'GitHub Copilot',
    locationHint: './.github/',
    description: 'GitHub Copilot project directory',
  },
});

const GUIDED_PROFILES = Object.freeze({
  full: {
    id: 'full',
    label: 'Full Curated Suite',
    description: 'All 21 curated skills, 9 agents, 30 commands, and 6 legacy shims',
    useAllCatalog: true,
  },
  core: {
    id: 'core',
    label: 'Core Developer',
    description: 'Everyday planning, coding standards, TDD, code review, compacting & verification',
    skills: [
      'blueprint',
      'coding-standards',
      'configure-ecc',
      'prompt-optimizer',
      'strategic-compact',
      'tdd-workflow',
      'verification-loop',
    ],
    agents: [
      'architect',
      'build-error-resolver',
      'code-reviewer',
      'planner',
    ],
    commands: [
      'build-fix',
      'checkpoint',
      'code-review',
      'plan',
      'resume-session',
      'save-session',
      'test-coverage',
    ],
    shims: ['tdd', 'verify', 'prompt-optimize'],
  },
  agentic: {
    id: 'agentic',
    label: 'Agentic & Continuous Learning',
    description: 'Autonomous loops, harness engineering, instinct memory, model routing & multi-agent workflows',
    skills: [
      'agent-harness-construction',
      'autonomous-agent-harness',
      'autonomous-loops',
      'continuous-agent-loop',
      'continuous-learning',
      'continuous-learning-v2',
      'dmux-workflows',
      'eval-harness',
    ],
    agents: [
      'architect',
      'harness-optimizer',
      'loop-operator',
      'planner',
    ],
    commands: [
      'evolve',
      'harness-audit',
      'instinct-export',
      'instinct-import',
      'instinct-status',
      'learn',
      'learn-eval',
      'loop-start',
      'loop-status',
      'model-route',
      'multi-execute',
      'multi-plan',
      'multi-workflow',
      'promote',
      'skill-create',
    ],
    shims: ['eval', 'orchestrate'],
  },
  frontend: {
    id: 'frontend',
    label: 'Frontend & Liquid Glass UI',
    description: 'Liquid Glass design, React/UI patterns, API design, E2E testing & TDD',
    skills: [
      'api-design',
      'e2e-testing',
      'frontend-patterns',
      'liquid-glass-design',
      'tdd-workflow',
    ],
    agents: [
      'architect',
      'build-error-resolver',
      'code-reviewer',
      'e2e-runner',
    ],
    commands: [
      'build-fix',
      'code-review',
      'multi-backend',
      'multi-frontend',
      'plan',
      'test-coverage',
      'update-codemaps',
    ],
    shims: ['e2e', 'tdd'],
  },
  devops: {
    id: 'devops',
    label: 'DevOps, DB & Docs',
    description: 'Deployment patterns, database migrations, codemaps, documentation & refactoring',
    skills: [
      'coding-standards',
      'database-migrations',
      'deployment-patterns',
      'verification-loop',
    ],
    agents: [
      'architect',
      'build-error-resolver',
      'doc-updater',
      'refactor-cleaner',
    ],
    commands: [
      'build-fix',
      'checkpoint',
      'projects',
      'refactor-clean',
      'sessions',
      'setup-pm',
      'update-codemaps',
      'update-docs',
    ],
    shims: ['verify'],
  },
  custom: {
    id: 'custom',
    label: 'Custom Selection',
    description: 'Pick specific skill, agent, command, or shim IDs manually',
    isCustom: true,
  },
});

const VALID_GUIDED_PROFILE_IDS = Object.freeze(Object.keys(GUIDED_PROFILES));

function dedupeStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(v => String(v || '').trim()).filter(Boolean))];
}

function splitCsvValues(raw) {
  return dedupeStrings(String(raw || '').split(','));
}

function expandTilde(inputPath, homeDir) {
  if (typeof inputPath !== 'string') return inputPath;
  const trimmed = inputPath.trim();
  if (trimmed === '~') return homeDir;
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(homeDir, trimmed.slice(2));
  }
  return trimmed;
}

function assertSafeId(id, label = 'component id') {
  if (!SAFE_ID_PATTERN.test(id) || id.includes('..')) {
    throw new Error(`Invalid ${label}: "${id}"`);
  }
}

function assertWithinRoot(rootDir, targetPath) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);
  const rel = path.relative(resolvedRoot, resolvedTarget);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    return resolvedTarget;
  }
  throw new Error(`Refusing path outside target root: ${resolvedTarget}`);
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function readJsonOptional(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Failed to read JSON at ${filePath}: ${error.message}`);
  }
}

function listFilesRecursive(dirPath) {
  const results = [];
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIR_NAMES.has(entry.name)) continue;
        walk(path.join(currentDir, entry.name));
      } else if (entry.isFile()) {
        if (IGNORED_FILE_NAMES.has(entry.name) || entry.name.endsWith('.pyc') || entry.name.endsWith('.pyo')) {
          continue;
        }
        results.push(path.relative(dirPath, path.join(currentDir, entry.name)));
      }
    }
  }
  if (fs.existsSync(dirPath)) {
    walk(dirPath);
  }
  return results;
}

function discoverCatalog(repoRoot = DEFAULT_REPO_ROOT) {
  const resolvedRoot = path.resolve(repoRoot);
  const skillsDir = path.join(resolvedRoot, 'skills');
  const agentsDir = path.join(resolvedRoot, 'agents');
  const commandsDir = path.join(resolvedRoot, 'commands');
  const shimsDir = path.join(resolvedRoot, 'legacy-command-shims', 'commands');

  const skills = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort()
    : [];

  const agents = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name.slice(0, -3))
      .sort()
    : [];

  const commands = fs.existsSync(commandsDir)
    ? fs.readdirSync(commandsDir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name.slice(0, -3))
      .sort()
    : [];

  const shims = fs.existsSync(shimsDir)
    ? fs.readdirSync(shimsDir, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name.slice(0, -3))
      .sort()
    : [];

  const repoConfig = readJsonOptional(path.join(resolvedRoot, 'ecc-install.json'));
  const configuredMap = repoConfig && repoConfig.options && repoConfig.options.legacyShims;
  const shimCanonicalMap = {};
  for (const shimId of shims) {
    const mapped = configuredMap && Array.isArray(configuredMap[shimId])
      ? configuredMap[shimId]
      : (DEFAULT_SHIM_CANONICAL_MAP[shimId] || []);
    shimCanonicalMap[shimId] = dedupeStrings(mapped);
  }

  return {
    repoRoot: resolvedRoot,
    skills,
    agents,
    commands,
    shims,
    skillSet: new Set(skills),
    agentSet: new Set(agents),
    commandSet: new Set(commands),
    shimSet: new Set(shims),
    shimCanonicalMap,
  };
}

function loadInstallConfig(configPath, options = {}) {
  const cwd = options.cwd || process.cwd();
  const resolvedPath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(cwd, configPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Install config not found: ${resolvedPath}`);
  }

  const raw = readJsonOptional(resolvedPath);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Invalid install config ${resolvedPath}: expected a JSON object`);
  }
  if (raw.version !== 1) {
    throw new Error(`Invalid install config ${resolvedPath}: version must be 1`);
  }
  if (raw.target && !SUPPORTED_TARGETS.includes(raw.target)) {
    throw new Error(`Invalid install config ${resolvedPath}: unsupported target "${raw.target}"`);
  }

  const opts = raw.options && typeof raw.options === 'object' && !Array.isArray(raw.options)
    ? raw.options
    : {};

  return {
    path: resolvedPath,
    version: raw.version,
    target: raw.target || null,
    options: {
      includeCanonicalForShims: opts.includeCanonicalForShims !== false,
      installShims: opts.installShims !== false,
      skills: dedupeStrings(opts.skills),
      canonicalSkills: dedupeStrings(opts.canonicalSkills),
      agents: dedupeStrings(opts.agents),
      commands: dedupeStrings(opts.commands),
      legacyShims: opts.legacyShims && typeof opts.legacyShims === 'object' ? opts.legacyShims : {},
    },
  };
}

function findConfigForInvocation({ explicitConfigPath, projectRoot, repoRoot }) {
  if (explicitConfigPath) {
    return loadInstallConfig(explicitConfigPath, { cwd: projectRoot });
  }
  const cwdCandidate = path.join(projectRoot, 'ecc-install.json');
  if (fs.existsSync(cwdCandidate)) {
    return loadInstallConfig(cwdCandidate, { cwd: projectRoot });
  }
  const repoCandidate = path.join(repoRoot, 'ecc-install.json');
  if (fs.existsSync(repoCandidate)) {
    return loadInstallConfig(repoCandidate, { cwd: repoRoot });
  }
  return null;
}

function resolveTargetSpec(target, options = {}) {
  const homeDir = path.resolve(options.homeDir || os.homedir());
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const env = options.env || process.env;

  if (options.dest) {
    const destRoot = path.isAbsolute(options.dest)
      ? path.resolve(options.dest)
      : path.resolve(projectRoot, options.dest);
    return {
      target: target || 'custom',
      targetRoot: destRoot,
      skillsSubdir: 'skills',
      agentsSubdir: 'agents',
      commandsSubdir: 'commands',
      stateRelativePath: 'ecc-curated-state.json',
    };
  }

  const resolvedTarget = target || 'claude';
  if (!SUPPORTED_TARGETS.includes(resolvedTarget)) {
    throw new Error(
      `Unknown install target: "${resolvedTarget}". Supported targets: ${SUPPORTED_TARGETS.join(', ')}`
    );
  }

  switch (resolvedTarget) {
    case 'claude': {
      const configured = typeof env.CLAUDE_CONFIG_DIR === 'string' ? env.CLAUDE_CONFIG_DIR.trim() : '';
      const root = configured ? path.resolve(expandTilde(configured, homeDir)) : path.join(homeDir, '.claude');
      return {
        target: 'claude',
        targetRoot: root,
        skillsSubdir: 'skills',
        agentsSubdir: 'agents',
        commandsSubdir: 'commands',
        stateRelativePath: path.join('ecc', 'curated-state.json'),
      };
    }
    case 'claude-project':
      return {
        target: 'claude-project',
        targetRoot: path.join(projectRoot, '.claude'),
        skillsSubdir: 'skills',
        agentsSubdir: 'agents',
        commandsSubdir: 'commands',
        stateRelativePath: path.join('ecc', 'curated-state.json'),
      };
    case 'arena':
      return {
        target: 'arena',
        targetRoot: path.join(projectRoot, '.agents'),
        skillsSubdir: 'skills',
        agentsSubdir: 'agents',
        commandsSubdir: 'workflows',
        stateRelativePath: 'ecc-curated-state.json',
      };
    case 'antigravity':
      return {
        target: 'antigravity',
        targetRoot: path.join(projectRoot, '.agents'),
        skillsSubdir: 'skills',
        agentsSubdir: 'agents',
        commandsSubdir: 'workflows',
        stateRelativePath: 'ecc-curated-state.json',
      };
    case 'cursor':
      return {
        target: 'cursor',
        targetRoot: path.join(projectRoot, '.cursor'),
        skillsSubdir: 'skills',
        agentsSubdir: 'agents',
        commandsSubdir: 'commands',
        stateRelativePath: 'ecc-curated-state.json',
      };
    case 'codex':
      return {
        target: 'codex',
        targetRoot: path.join(homeDir, '.codex'),
        skillsSubdir: 'skills',
        agentsSubdir: 'agents',
        commandsSubdir: 'commands',
        stateRelativePath: 'ecc-curated-state.json',
      };
    case 'opencode': {
      const configured = typeof env.OPENCODE_CONFIG_DIR === 'string' ? env.OPENCODE_CONFIG_DIR.trim() : '';
      const xdg = typeof env.XDG_CONFIG_HOME === 'string' ? env.XDG_CONFIG_HOME.trim() : '';
      const root = configured
        ? path.resolve(expandTilde(configured, homeDir))
        : path.join(xdg ? path.resolve(expandTilde(xdg, homeDir)) : path.join(homeDir, '.config'), 'opencode');
      return {
        target: 'opencode',
        targetRoot: root,
        skillsSubdir: 'skills',
        agentsSubdir: 'agents',
        commandsSubdir: 'commands',
        stateRelativePath: 'ecc-curated-state.json',
      };
    }
    case 'gemini':
      return {
        target: 'gemini',
        targetRoot: path.join(projectRoot, '.gemini'),
        skillsSubdir: 'skills',
        agentsSubdir: 'agents',
        commandsSubdir: 'commands',
        stateRelativePath: 'ecc-curated-state.json',
      };
    case 'kimi':
      return {
        target: 'kimi',
        targetRoot: path.join(projectRoot, '.kimi-code'),
        skillsSubdir: 'skills',
        agentsSubdir: 'agents',
        commandsSubdir: 'commands',
        stateRelativePath: 'ecc-curated-state.json',
      };
    case 'copilot':
      return {
        target: 'copilot',
        targetRoot: path.join(projectRoot, '.github'),
        skillsSubdir: 'skills',
        agentsSubdir: 'agents',
        commandsSubdir: 'commands',
        stateRelativePath: 'ecc-curated-state.json',
      };
    default:
      throw new Error(`Unsupported target: ${resolvedTarget}`);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    guided: false,
    target: null,
    targets: [],
    allTargets: false,
    profile: null,
    dest: null,
    configPath: null,
    skills: [],
    agents: [],
    commands: [],
    withComponents: [],
    withoutComponents: [],
    includeCanonical: null,
    installShims: null,
    dryRun: false,
    json: false,
    force: false,
    yes: false,
    list: false,
    uninstall: false,
    help: false,
  };

  function readNextValue(flag, index) {
    const val = args[index + 1];
    if (val === undefined || val.startsWith('-')) {
      throw new Error(`Missing value for ${flag}`);
    }
    return val;
  }

  for (let i = 0; i < args.length; i += 1) {
    const raw = args[i];
    let flag = raw;
    let inlineValue = null;

    if (raw.startsWith('--') && raw.includes('=')) {
      const eqIdx = raw.indexOf('=');
      flag = raw.slice(0, eqIdx);
      inlineValue = raw.slice(eqIdx + 1);
    }

    const takeValue = () => {
      if (inlineValue !== null) return inlineValue;
      const v = readNextValue(flag, i);
      i += 1;
      return v;
    };

    if (flag === '--help' || flag === '-h') {
      parsed.help = true;
    } else if (flag === '--guided' || flag === '-g') {
      parsed.guided = true;
    } else if (flag === '--list') {
      parsed.list = true;
    } else if (flag === '--dry-run') {
      parsed.dryRun = true;
    } else if (flag === '--json') {
      parsed.json = true;
    } else if (flag === '--force') {
      parsed.force = true;
    } else if (flag === '--yes' || flag === '-y') {
      parsed.yes = true;
    } else if (flag === '--uninstall') {
      parsed.uninstall = true;
    } else if (flag === '--all-targets' || flag === '--all-harnesses') {
      parsed.allTargets = true;
    } else if (flag === '--shims') {
      parsed.installShims = true;
    } else if (flag === '--no-shims') {
      parsed.installShims = false;
    } else if (flag === '--canonical') {
      parsed.includeCanonical = true;
    } else if (flag === '--no-canonical') {
      parsed.includeCanonical = false;
    } else if (flag === '--target' || flag === '--targets' || flag === '--harness' || flag === '--harnesses') {
      const vals = splitCsvValues(takeValue());
      if (vals.length === 0) throw new Error(`Missing target name(s) for ${flag}`);
      if (vals.includes('all')) {
        parsed.allTargets = true;
        for (const v of vals) {
          if (v !== 'all') parsed.targets.push(v);
        }
      } else {
        parsed.targets.push(...vals);
      }
      parsed.targets = dedupeStrings(parsed.targets);
      if (parsed.targets.length > 0) {
        parsed.target = parsed.targets[parsed.targets.length - 1];
      }
    } else if (flag === '--profile') {
      const val = takeValue().trim();
      if (!val) throw new Error(`Missing value for ${flag}`);
      parsed.profile = val;
    } else if (flag === '--dest') {
      parsed.dest = takeValue();
    } else if (flag === '--config') {
      parsed.configPath = takeValue();
    } else if (flag === '--skills' || flag === '--skill') {
      const vals = splitCsvValues(takeValue());
      if (vals.length === 0) throw new Error(`Missing component IDs for ${flag}`);
      parsed.skills.push(...vals);
    } else if (flag === '--agents' || flag === '--agent') {
      const vals = splitCsvValues(takeValue());
      if (vals.length === 0) throw new Error(`Missing component IDs for ${flag}`);
      parsed.agents.push(...vals);
    } else if (flag === '--commands' || flag === '--command') {
      const vals = splitCsvValues(takeValue());
      if (vals.length === 0) throw new Error(`Missing component IDs for ${flag}`);
      parsed.commands.push(...vals);
    } else if (flag === '--with') {
      const vals = splitCsvValues(takeValue());
      if (vals.length === 0) throw new Error(`Missing component IDs for ${flag}`);
      parsed.withComponents.push(...vals);
    } else if (flag === '--without') {
      const vals = splitCsvValues(takeValue());
      if (vals.length === 0) throw new Error(`Missing component IDs for ${flag}`);
      parsed.withoutComponents.push(...vals);
    } else if (flag.startsWith('-')) {
      throw new Error(`Unknown option: ${flag}`);
    } else {
      throw new Error(`Unexpected positional argument: ${raw}`);
    }
  }

  return parsed;
}

function getGuidedProfile(profileId, catalog = discoverCatalog()) {
  const id = String(profileId || '').trim();
  const def = GUIDED_PROFILES[id];
  if (!def) {
    throw new Error(
      `Unknown profile: "${profileId}". Supported profiles: ${VALID_GUIDED_PROFILE_IDS.join(', ')}`
    );
  }
  if (def.useAllCatalog) {
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      useAllCatalog: true,
      isCustom: false,
      skills: [...catalog.skills],
      agents: [...catalog.agents],
      commands: [...catalog.commands],
      shims: [...catalog.shims],
    };
  }
  if (def.isCustom) {
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      useAllCatalog: false,
      isCustom: true,
      skills: [],
      agents: [],
      commands: [],
      shims: [],
    };
  }
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    useAllCatalog: false,
    isCustom: false,
    skills: (def.skills || []).filter(s => catalog.skillSet.has(s)),
    agents: (def.agents || []).filter(a => catalog.agentSet.has(a)),
    commands: (def.commands || []).filter(c => catalog.commandSet.has(c)),
    shims: (def.shims || []).filter(s => catalog.shimSet.has(s)),
  };
}

function listGuidedProfiles(catalog = discoverCatalog()) {
  return VALID_GUIDED_PROFILE_IDS.map(id => getGuidedProfile(id, catalog));
}

function resolveSelection(parsed, catalog, config) {
  const hasExplicitSelection = parsed.skills.length > 0
    || parsed.agents.length > 0
    || parsed.commands.length > 0
    || parsed.withComponents.length > 0;

  const includeCanonical = parsed.includeCanonical !== null
    ? parsed.includeCanonical
    : (config ? config.options.includeCanonicalForShims : true);

  const installShims = parsed.installShims !== null
    ? parsed.installShims
    : (config ? config.options.installShims : true);

  const selectedSkills = new Set();
  const selectedAgents = new Set();
  const selectedCommands = new Set();
  const selectedShims = new Set();
  const resolvedAliases = {
    agentsFromSkillsFlag: [],
    commandsFromSkillsFlag: [],
    shimsFromSkillsFlag: [],
    canonicalAddedFromShims: [],
  };

  function addByPrefixOrFamily(token, sourceFlag) {
    const trimmed = String(token || '').trim();
    if (!trimmed) return;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const family = trimmed.slice(0, colonIdx);
      const id = trimmed.slice(colonIdx + 1);
      assertSafeId(id, `${family} id`);

      if (family === 'skill') {
        if (!catalog.skillSet.has(id)) throw new Error(`Unknown skill: "${id}"`);
        selectedSkills.add(id);
        return;
      }
      if (family === 'agent') {
        if (!catalog.agentSet.has(id)) throw new Error(`Unknown agent: "${id}"`);
        selectedAgents.add(id);
        return;
      }
      if (family === 'command') {
        if (!catalog.commandSet.has(id)) throw new Error(`Unknown command: "${id}"`);
        selectedCommands.add(id);
        return;
      }
      if (family === 'shim') {
        if (!catalog.shimSet.has(id)) throw new Error(`Unknown legacy shim: "${id}"`);
        selectedShims.add(id);
        return;
      }
      throw new Error(`Unknown component family "${family}" in "${trimmed}"`);
    }

    assertSafeId(trimmed, 'component id');

    if (sourceFlag === 'agents') {
      if (!catalog.agentSet.has(trimmed)) throw new Error(`Unknown agent: "${trimmed}"`);
      selectedAgents.add(trimmed);
      return;
    }

    if (sourceFlag === 'commands') {
      if (catalog.commandSet.has(trimmed)) {
        selectedCommands.add(trimmed);
        return;
      }
      if (catalog.shimSet.has(trimmed)) {
        selectedShims.add(trimmed);
        return;
      }
      throw new Error(`Unknown command: "${trimmed}"`);
    }

    // For --skills / --with bare IDs: resolve across skills, agents, commands, and legacy shims
    if (catalog.skillSet.has(trimmed)) {
      selectedSkills.add(trimmed);
      return;
    }
    if (catalog.agentSet.has(trimmed)) {
      selectedAgents.add(trimmed);
      if (sourceFlag === 'skills') resolvedAliases.agentsFromSkillsFlag.push(trimmed);
      return;
    }
    if (catalog.commandSet.has(trimmed)) {
      selectedCommands.add(trimmed);
      if (sourceFlag === 'skills') resolvedAliases.commandsFromSkillsFlag.push(trimmed);
      return;
    }
    if (catalog.shimSet.has(trimmed)) {
      selectedShims.add(trimmed);
      if (sourceFlag === 'skills') resolvedAliases.shimsFromSkillsFlag.push(trimmed);
      return;
    }

    throw new Error(
      `Unknown install component: "${trimmed}". Run with --list to see available skills, agents, commands, and shims.`
    );
  }

  const profileId = parsed.profile ? String(parsed.profile).trim() : null;
  if (profileId) {
    const profile = getGuidedProfile(profileId, catalog);
    if (profile.isCustom) {
      if (!hasExplicitSelection) {
        throw new Error('Profile "custom" requires explicit components (--skills, --agents, --commands, or --with).');
      }
    } else if (profile.useAllCatalog && config) {
      for (const id of config.options.skills) addByPrefixOrFamily(`skill:${id}`, 'config');
      for (const id of config.options.canonicalSkills) {
        if (includeCanonical && catalog.skillSet.has(id)) {
          selectedSkills.add(id);
        }
      }
      for (const id of config.options.agents) addByPrefixOrFamily(`agent:${id}`, 'config');
      for (const id of config.options.commands) addByPrefixOrFamily(`command:${id}`, 'config');
      for (const id of Object.keys(config.options.legacyShims || {})) {
        addByPrefixOrFamily(`shim:${id}`, 'config');
      }
    } else {
      for (const id of profile.skills) selectedSkills.add(id);
      for (const id of profile.agents) selectedAgents.add(id);
      for (const id of profile.commands) selectedCommands.add(id);
      for (const id of profile.shims) selectedShims.add(id);
    }
  } else if (!hasExplicitSelection) {
    if (config) {
      for (const id of config.options.skills) addByPrefixOrFamily(`skill:${id}`, 'config');
      for (const id of config.options.canonicalSkills) {
        if (includeCanonical && catalog.skillSet.has(id)) {
          selectedSkills.add(id);
        }
      }
      for (const id of config.options.agents) addByPrefixOrFamily(`agent:${id}`, 'config');
      for (const id of config.options.commands) addByPrefixOrFamily(`command:${id}`, 'config');
      for (const id of Object.keys(config.options.legacyShims || {})) {
        addByPrefixOrFamily(`shim:${id}`, 'config');
      }
    } else {
      throw new Error('No components selected and no ecc-install.json found.');
    }
  }

  if (hasExplicitSelection) {
    for (const id of parsed.skills) addByPrefixOrFamily(id, 'skills');
    for (const id of parsed.agents) addByPrefixOrFamily(id, 'agents');
    for (const id of parsed.commands) addByPrefixOrFamily(id, 'commands');
    for (const comp of parsed.withComponents) addByPrefixOrFamily(comp, 'with');
  }

  // Expand legacy shims to their canonical replacement skills when enabled
  if (includeCanonical) {
    for (const shimId of selectedShims) {
      const canonicalIds = catalog.shimCanonicalMap[shimId] || [];
      for (const canonicalId of canonicalIds) {
        if (catalog.skillSet.has(canonicalId) && !selectedSkills.has(canonicalId)) {
          selectedSkills.add(canonicalId);
          resolvedAliases.canonicalAddedFromShims.push({ shim: shimId, skill: canonicalId });
        }
      }
    }
  }

  // Apply --without exclusions
  for (const rawExclusion of parsed.withoutComponents) {
    const trimmed = rawExclusion.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const family = trimmed.slice(0, colonIdx);
      const id = trimmed.slice(colonIdx + 1);
      assertSafeId(id, `${family} id`);
      if (family === 'skill') selectedSkills.delete(id);
      else if (family === 'agent') selectedAgents.delete(id);
      else if (family === 'command') selectedCommands.delete(id);
      else if (family === 'shim') selectedShims.delete(id);
      else throw new Error(`Unknown component family "${family}" in "${trimmed}"`);
    } else {
      assertSafeId(trimmed, 'component id');
      selectedSkills.delete(trimmed);
      selectedAgents.delete(trimmed);
      selectedCommands.delete(trimmed);
      selectedShims.delete(trimmed);
    }
  }

  const effectiveShims = installShims ? [...selectedShims].sort() : [];

  const selection = {
    skills: [...selectedSkills].sort(),
    agents: [...selectedAgents].sort(),
    commands: [...selectedCommands].sort(),
    shims: effectiveShims,
    skippedShims: installShims ? [] : [...selectedShims].sort(),
  };

  if (
    selection.skills.length === 0
    && selection.agents.length === 0
    && selection.commands.length === 0
    && selection.shims.length === 0
  ) {
    throw new Error('Selection resulted in zero components to install.');
  }

  return {
    mode: profileId ? `profile:${profileId}` : (hasExplicitSelection ? 'cli' : 'config'),
    profile: profileId,
    includeCanonical,
    installShims,
    selection,
    resolvedAliases,
  };
}

function createInstallPlan(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || DEFAULT_REPO_ROOT);
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const homeDir = path.resolve(options.homeDir || os.homedir());
  const env = options.env || process.env;

  const catalog = discoverCatalog(repoRoot);
  const config = findConfigForInvocation({
    explicitConfigPath: options.configPath || null,
    projectRoot,
    repoRoot,
  });

  const resolvedTargetName = options.dest && !options.target
    ? 'custom'
    : (options.target || (config && config.target) || 'claude');
  const targetSpec = resolveTargetSpec(resolvedTargetName, {
    homeDir,
    projectRoot,
    env,
    dest: options.dest || null,
  });

  const resolved = resolveSelection(
    {
      profile: options.profile || null,
      skills: options.skills || [],
      agents: options.agents || [],
      commands: options.commands || [],
      withComponents: options.withComponents || [],
      withoutComponents: options.withoutComponents || [],
      includeCanonical: options.includeCanonical ?? null,
      installShims: options.installShims ?? null,
    },
    catalog,
    config
  );

  const installStatePath = assertWithinRoot(
    targetSpec.targetRoot,
    path.join(targetSpec.targetRoot, targetSpec.stateRelativePath)
  );
  const existingState = readJsonOptional(installStatePath);
  const trackedFiles = (existingState && existingState.files && typeof existingState.files === 'object')
    ? existingState.files
    : {};

  const operations = [];
  const warnings = [];
  const plannedDestinations = new Set();

  function addCopyOperation({ kind, id, sourcePath, destinationPath }) {
    const safeDest = assertWithinRoot(targetSpec.targetRoot, destinationPath);
    const relDest = path.relative(targetSpec.targetRoot, safeDest);
    if (plannedDestinations.has(relDest)) {
      return;
    }
    plannedDestinations.add(relDest);

    const srcStat = fs.statSync(sourcePath);
    const srcHash = sha256File(sourcePath);
    let action = 'create';
    let conflict = false;

    if (fs.existsSync(safeDest)) {
      const dstLstat = fs.lstatSync(safeDest);
      if (dstLstat.isSymbolicLink() || !dstLstat.isFile()) {
        throw new Error(`Destination exists and is not a regular file: ${safeDest}`);
      }
      const dstHash = sha256File(safeDest);
      const isManaged = Object.prototype.hasOwnProperty.call(trackedFiles, relDest);
      if (dstHash === srcHash) {
        action = 'unchanged';
      } else if (isManaged || options.force) {
        action = 'update';
      } else {
        action = 'skip-conflict';
        conflict = true;
        warnings.push(
          `Preserved unmanaged existing file (use --force to overwrite): ${safeDest}`
        );
      }
    }

    operations.push({
      kind,
      id,
      sourcePath,
      sourceRelativePath: path.relative(repoRoot, sourcePath),
      destinationPath: safeDest,
      destinationRelativePath: relDest,
      sha256: srcHash,
      mode: (srcStat.mode & 0o111) ? 0o755 : 0o644,
      action,
      conflict,
    });
  }

  for (const skillId of resolved.selection.skills) {
    const skillDir = path.join(repoRoot, 'skills', skillId);
    const relFiles = listFilesRecursive(skillDir);
    for (const relFile of relFiles) {
      addCopyOperation({
        kind: 'skill',
        id: skillId,
        sourcePath: path.join(skillDir, relFile),
        destinationPath: path.join(targetSpec.targetRoot, targetSpec.skillsSubdir, skillId, relFile),
      });
    }
  }

  for (const agentId of resolved.selection.agents) {
    addCopyOperation({
      kind: 'agent',
      id: agentId,
      sourcePath: path.join(repoRoot, 'agents', `${agentId}.md`),
      destinationPath: path.join(targetSpec.targetRoot, targetSpec.agentsSubdir, `${agentId}.md`),
    });
  }

  for (const commandId of resolved.selection.commands) {
    addCopyOperation({
      kind: 'command',
      id: commandId,
      sourcePath: path.join(repoRoot, 'commands', `${commandId}.md`),
      destinationPath: path.join(targetSpec.targetRoot, targetSpec.commandsSubdir, `${commandId}.md`),
    });
  }

  for (const shimId of resolved.selection.shims) {
    addCopyOperation({
      kind: 'shim',
      id: shimId,
      sourcePath: path.join(repoRoot, 'legacy-command-shims', 'commands', `${shimId}.md`),
      destinationPath: path.join(targetSpec.targetRoot, targetSpec.commandsSubdir, `${shimId}.md`),
    });
  }

  return {
    repoRoot,
    configPath: config ? config.path : null,
    mode: resolved.mode,
    profile: resolved.profile || null,
    target: targetSpec.target,
    targetRoot: targetSpec.targetRoot,
    installStatePath,
    selection: resolved.selection,
    resolvedAliases: resolved.resolvedAliases,
    includeCanonical: resolved.includeCanonical,
    installShims: resolved.installShims,
    warnings,
    operations,
  };
}

function applyInstallPlan(plan) {
  const existingState = readJsonOptional(plan.installStatePath);
  const nextTrackedFiles = {
    ...((existingState && existingState.files && typeof existingState.files === 'object')
      ? existingState.files
      : {}),
  };

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const op of plan.operations) {
    if (op.action === 'skip-conflict') {
      skipped += 1;
      continue;
    }

    fs.mkdirSync(path.dirname(op.destinationPath), { recursive: true });
    if (op.action !== 'unchanged') {
      fs.copyFileSync(op.sourcePath, op.destinationPath);
      fs.chmodSync(op.destinationPath, op.mode);
    }

    if (op.action === 'create') created += 1;
    else if (op.action === 'update') updated += 1;
    else if (op.action === 'unchanged') unchanged += 1;

    nextTrackedFiles[op.destinationRelativePath] = {
      sha256: op.sha256,
      kind: op.kind,
      id: op.id,
    };
  }

  const nextState = {
    version: 1,
    target: plan.target,
    targetRoot: plan.targetRoot,
    installedAt: new Date().toISOString(),
    selection: plan.selection,
    files: nextTrackedFiles,
  };

  fs.mkdirSync(path.dirname(plan.installStatePath), { recursive: true });
  fs.writeFileSync(plan.installStatePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');

  return {
    ...plan,
    summary: {
      total: plan.operations.length,
      created,
      updated,
      unchanged,
      skipped,
    },
  };
}

function uninstallFromTarget(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || DEFAULT_REPO_ROOT);
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const homeDir = path.resolve(options.homeDir || os.homedir());
  const env = options.env || process.env;

  const config = findConfigForInvocation({
    explicitConfigPath: options.configPath || null,
    projectRoot,
    repoRoot,
  });
  const resolvedTargetName = options.dest && !options.target
    ? 'custom'
    : (options.target || (config && config.target) || 'claude');
  const targetSpec = resolveTargetSpec(resolvedTargetName, {
    homeDir,
    projectRoot,
    env,
    dest: options.dest || null,
  });
  const installStatePath = assertWithinRoot(
    targetSpec.targetRoot,
    path.join(targetSpec.targetRoot, targetSpec.stateRelativePath)
  );
  const state = readJsonOptional(installStatePath);
  if (!state || !state.files || typeof state.files !== 'object') {
    return {
      target: targetSpec.target,
      targetRoot: targetSpec.targetRoot,
      installStatePath,
      removed: [],
      preserved: [],
    };
  }

  const removed = [];
  const preserved = [];

  for (const [relPath, entry] of Object.entries(state.files)) {
    const absPath = assertWithinRoot(targetSpec.targetRoot, path.join(targetSpec.targetRoot, relPath));
    if (!fs.existsSync(absPath)) continue;
    const lstat = fs.lstatSync(absPath);
    if (lstat.isSymbolicLink() || !lstat.isFile()) {
      preserved.push(absPath);
      continue;
    }
    const currentHash = sha256File(absPath);
    if (currentHash === entry.sha256 || options.force) {
      if (!options.dryRun) {
        fs.unlinkSync(absPath);
        pruneEmptyParents(path.dirname(absPath), targetSpec.targetRoot);
      }
      removed.push(absPath);
    } else {
      preserved.push(absPath);
    }
  }

  if (!options.dryRun) {
    if (preserved.length === 0 && fs.existsSync(installStatePath)) {
      fs.unlinkSync(installStatePath);
      pruneEmptyParents(path.dirname(installStatePath), targetSpec.targetRoot);
    } else if (preserved.length > 0) {
      const remaining = {};
      for (const [relPath, entry] of Object.entries(state.files)) {
        const absPath = assertWithinRoot(targetSpec.targetRoot, path.join(targetSpec.targetRoot, relPath));
        if (preserved.includes(absPath)) {
          remaining[relPath] = entry;
        }
      }
      fs.writeFileSync(
        installStatePath,
        `${JSON.stringify({ ...state, files: remaining }, null, 2)}\n`,
        'utf8'
      );
    }
  }

  return {
    target: targetSpec.target,
    targetRoot: targetSpec.targetRoot,
    installStatePath,
    removed,
    preserved,
  };
}

function pruneEmptyParents(dirPath, stopRoot) {
  let current = path.resolve(dirPath);
  const root = path.resolve(stopRoot);
  while (current !== root && current.startsWith(root + path.sep)) {
    const entries = fs.readdirSync(current);
    if (entries.length > 0) break;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

function inspectTargets(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const homeDir = path.resolve(options.homeDir || os.homedir());
  const env = options.env || process.env;
  const targets = Array.isArray(options.targets) && options.targets.length > 0
    ? options.targets
    : Object.keys(TARGET_METADATA);

  return targets.map(targetName => {
    const meta = TARGET_METADATA[targetName] || {
      label: targetName,
      locationHint: '',
      description: '',
    };
    const spec = resolveTargetSpec(targetName, { homeDir, projectRoot, env });
    const statePath = path.join(spec.targetRoot, spec.stateRelativePath);
    const state = readJsonOptional(statePath);
    const files = state && state.files && typeof state.files === 'object' ? state.files : {};
    const fileCount = Object.keys(files).length;

    return {
      target: targetName,
      label: meta.label,
      locationHint: meta.locationHint,
      description: meta.description,
      targetRoot: spec.targetRoot,
      commandsSubdir: spec.commandsSubdir,
      installStatePath: statePath,
      installed: fileCount > 0,
      fileCount,
      installedAt: state && state.installedAt ? state.installedAt : null,
    };
  });
}

function resolveGuidedTargetList(options = {}) {
  if (options.dest && (!options.targets || options.targets.length === 0) && !options.allTargets) {
    return [{ target: 'custom', dest: options.dest }];
  }

  let requested;
  if (options.allTargets) {
    requested = [...CANONICAL_ALL_TARGETS];
  } else {
    requested = dedupeStrings(options.targets || (options.target ? [options.target] : []));
  }

  if (requested.length === 0) {
    throw new Error('No install targets specified for guided plan.');
  }

  for (const t of requested) {
    if (!SUPPORTED_TARGETS.includes(t)) {
      throw new Error(
        `Unknown install target: "${t}". Supported targets: ${SUPPORTED_TARGETS.join(', ')}`
      );
    }
  }

  const homeDir = path.resolve(options.homeDir || os.homedir());
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const env = options.env || process.env;
  const seenRoots = new Map();
  const resolved = [];

  for (const t of requested) {
    const spec = resolveTargetSpec(t, { homeDir, projectRoot, env, dest: options.dest || null });
    const normalizedRoot = path.resolve(spec.targetRoot);
    if (seenRoots.has(normalizedRoot)) {
      seenRoots.get(normalizedRoot).aliases.push(t);
      continue;
    }
    const entry = {
      target: t,
      dest: options.dest || null,
      targetRoot: normalizedRoot,
      aliases: [],
    };
    seenRoots.set(normalizedRoot, entry);
    resolved.push(entry);
  }

  return resolved;
}

function summarizePlanOperations(plan) {
  let create = 0;
  let update = 0;
  let unchanged = 0;
  let skipped = 0;
  for (const op of plan.operations) {
    if (op.action === 'create') create += 1;
    else if (op.action === 'update') update += 1;
    else if (op.action === 'unchanged') unchanged += 1;
    else if (op.action === 'skip-conflict') skipped += 1;
  }
  return {
    total: plan.operations.length,
    create,
    update,
    unchanged,
    skipped,
  };
}

function createGuidedPlan(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || DEFAULT_REPO_ROOT);
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const homeDir = path.resolve(options.homeDir || os.homedir());
  const env = options.env || process.env;

  const hasExplicitComponents = (options.skills && options.skills.length > 0)
    || (options.agents && options.agents.length > 0)
    || (options.commands && options.commands.length > 0)
    || (options.withComponents && options.withComponents.length > 0);

  const profileId = options.profile || (hasExplicitComponents ? 'custom' : 'full');
  const resolvedTargets = resolveGuidedTargetList({
    targets: options.targets,
    target: options.target,
    allTargets: options.allTargets,
    dest: options.dest,
    homeDir,
    projectRoot,
    env,
  });

  const targetPlans = resolvedTargets.map(entry => {
    const plan = createInstallPlan({
      repoRoot,
      projectRoot,
      homeDir,
      env,
      target: entry.target === 'custom' ? null : entry.target,
      dest: entry.dest || null,
      configPath: options.configPath || null,
      profile: profileId,
      skills: options.skills || [],
      agents: options.agents || [],
      commands: options.commands || [],
      withComponents: options.withComponents || [],
      withoutComponents: options.withoutComponents || [],
      includeCanonical: options.includeCanonical ?? null,
      installShims: options.installShims ?? null,
      force: Boolean(options.force),
    });
    return {
      ...plan,
      aliases: entry.aliases,
      previewSummary: summarizePlanOperations(plan),
    };
  });

  const totals = targetPlans.reduce(
    (acc, plan) => ({
      targets: acc.targets + 1,
      operations: acc.operations + plan.previewSummary.total,
      create: acc.create + plan.previewSummary.create,
      update: acc.update + plan.previewSummary.update,
      unchanged: acc.unchanged + plan.previewSummary.unchanged,
      skipped: acc.skipped + plan.previewSummary.skipped,
      warnings: acc.warnings + plan.warnings.length,
    }),
    { targets: 0, operations: 0, create: 0, update: 0, unchanged: 0, skipped: 0, warnings: 0 }
  );

  return {
    mode: 'guided',
    repoRoot,
    profile: profileId,
    targets: targetPlans.map(p => p.target),
    selection: targetPlans[0].selection,
    includeCanonical: targetPlans[0].includeCanonical,
    installShims: targetPlans[0].installShims,
    targetPlans,
    totals,
  };
}

function applyGuidedPlan(guidedPlan) {
  const results = guidedPlan.targetPlans.map(plan => {
    const applied = applyInstallPlan(plan);
    return {
      ...applied,
      aliases: plan.aliases || [],
    };
  });

  const summary = results.reduce(
    (acc, r) => ({
      targets: acc.targets + 1,
      total: acc.total + r.summary.total,
      created: acc.created + r.summary.created,
      updated: acc.updated + r.summary.updated,
      unchanged: acc.unchanged + r.summary.unchanged,
      skipped: acc.skipped + r.summary.skipped,
    }),
    { targets: 0, total: 0, created: 0, updated: 0, unchanged: 0, skipped: 0 }
  );

  return {
    mode: 'guided',
    repoRoot: guidedPlan.repoRoot,
    profile: guidedPlan.profile,
    targets: guidedPlan.targets,
    selection: guidedPlan.selection,
    includeCanonical: guidedPlan.includeCanonical,
    installShims: guidedPlan.installShims,
    results,
    summary,
  };
}

module.exports = {
  CANONICAL_ALL_TARGETS,
  DEFAULT_REPO_ROOT,
  DEFAULT_SHIM_CANONICAL_MAP,
  GUIDED_PROFILES,
  SUPPORTED_TARGETS,
  TARGET_METADATA,
  VALID_GUIDED_PROFILE_IDS,
  applyGuidedPlan,
  applyInstallPlan,
  createGuidedPlan,
  createInstallPlan,
  discoverCatalog,
  getGuidedProfile,
  inspectTargets,
  listGuidedProfiles,
  loadInstallConfig,
  parseArgs,
  resolveTargetSpec,
  uninstallFromTarget,
};

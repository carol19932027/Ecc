'use strict';

const os = require('os');
const path = require('path');
const readline = require('node:readline/promises');

const {
  CANONICAL_ALL_TARGETS,
  DEFAULT_REPO_ROOT,
  SUPPORTED_TARGETS,
  VALID_GUIDED_PROFILE_IDS,
  applyGuidedPlan,
  createGuidedPlan,
  discoverCatalog,
  getGuidedProfile,
  inspectTargets,
  listGuidedProfiles,
} = require('./ecc-installer');

function splitTokens(raw) {
  return [...new Set(
    String(raw || '')
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean)
  )];
}

function parseYesNo(answer, defaultValue) {
  const normalized = String(answer || '').trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (['y', 'yes', 'true', '1'].includes(normalized)) return true;
  if (['n', 'no', 'false', '0'].includes(normalized)) return false;
  return null;
}

function makeColors(enabled) {
  if (!enabled) {
    return {
      bold: s => s,
      dim: s => s,
      cyan: s => s,
      green: s => s,
      yellow: s => s,
      red: s => s,
    };
  }
  return {
    bold: s => `\x1b[1m${s}\x1b[0m`,
    dim: s => `\x1b[2m${s}\x1b[0m`,
    cyan: s => `\x1b[36m${s}\x1b[0m`,
    green: s => `\x1b[32m${s}\x1b[0m`,
    yellow: s => `\x1b[33m${s}\x1b[0m`,
    red: s => `\x1b[31m${s}\x1b[0m`,
  };
}

function padRight(text, width) {
  const str = String(text);
  if (str.length >= width) return str;
  return str + ' '.repeat(width - str.length);
}

function formatGuidedPreview(guidedPlan, color) {
  const lines = [];
  const sel = guidedPlan.selection;
  lines.push('');
  lines.push(color.bold('ECC Guided Install Preview'));
  lines.push(
    `Profile: ${color.cyan(guidedPlan.profile)}  `
    + `(${sel.skills.length} skills, ${sel.agents.length} agents, `
    + `${sel.commands.length} commands, ${sel.shims.length} shims)`
  );
  lines.push('');

  const rows = guidedPlan.targetPlans.map(plan => {
    const label = plan.aliases && plan.aliases.length > 0
      ? `${plan.target} (+${plan.aliases.join(',')})`
      : plan.target;
    const s = plan.previewSummary;
    return {
      target: label,
      root: plan.targetRoot,
      create: String(s.create),
      update: String(s.update),
      unchanged: String(s.unchanged),
      skipped: String(s.skipped),
    };
  });

  const wTarget = Math.max(6, ...rows.map(r => r.target.length)) + 2;
  const wRoot = Math.max(11, ...rows.map(r => r.root.length)) + 2;

  lines.push(
    color.dim(
      `${padRight('Target', wTarget)}${padRight('Destination', wRoot)}`
      + `${padRight('Create', 8)}${padRight('Update', 8)}`
      + `${padRight('Keep', 8)}Skip`
    )
  );

  for (const r of rows) {
    lines.push(
      `${padRight(r.target, wTarget)}${padRight(r.root, wRoot)}`
      + `${padRight(r.create, 8)}${padRight(r.update, 8)}`
      + `${padRight(r.unchanged, 8)}${r.skipped}`
    );
  }

  const allWarnings = guidedPlan.targetPlans.flatMap(p => p.warnings || []);
  if (allWarnings.length > 0) {
    lines.push('');
    lines.push(color.yellow('Warnings:'));
    for (const w of allWarnings) {
      lines.push(`- ${w}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function formatGuidedApplied(applied, color) {
  const lines = [];
  lines.push('');
  lines.push(color.green(color.bold('ECC Guided Install Complete')));
  lines.push(
    `Profile: ${color.cyan(applied.profile)} | Targets: ${applied.summary.targets} | `
    + `${applied.summary.created} created, ${applied.summary.updated} updated, `
    + `${applied.summary.unchanged} unchanged, ${applied.summary.skipped} skipped`
  );
  lines.push('');
  for (const res of applied.results) {
    const aliasSuffix = res.aliases && res.aliases.length > 0
      ? ` (shared with ${res.aliases.join(', ')})`
      : '';
    lines.push(
      `- ${color.bold(res.target)}${aliasSuffix}: ${res.targetRoot} `
      + `[+${res.summary.created} ~${res.summary.updated} =${res.summary.unchanged} !${res.summary.skipped}]`
    );
    lines.push(`  state: ${res.installStatePath}`);
  }
  lines.push('');
  return lines.join('\n');
}

function parseTargetSelection(rawInput, defaultTargets) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return { allTargets: false, targets: defaultTargets };
  }

  const tokens = splitTokens(trimmed);
  const selected = [];
  let allTargets = false;

  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lower === 'a' || lower === 'all') {
      allTargets = true;
      continue;
    }
    if (/^\d+$/.test(tok)) {
      const idx = Number(tok) - 1;
      if (idx < 0 || idx >= SUPPORTED_TARGETS.length) {
        return { error: `Invalid target number "${tok}". Choose 1-${SUPPORTED_TARGETS.length} or "all".` };
      }
      selected.push(SUPPORTED_TARGETS[idx]);
      continue;
    }
    if (SUPPORTED_TARGETS.includes(lower)) {
      selected.push(lower);
      continue;
    }
    return {
      error: `Unknown target "${tok}". Choose numbers 1-${SUPPORTED_TARGETS.length}, "all", or names (${SUPPORTED_TARGETS.join(', ')}).`,
    };
  }

  if (allTargets) {
    return { allTargets: true, targets: [...CANONICAL_ALL_TARGETS] };
  }
  return { allTargets: false, targets: [...new Set(selected)] };
}

function parseProfileSelection(rawInput, defaultProfile, profiles) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return { profile: defaultProfile };
  }
  if (/^\d+$/.test(trimmed)) {
    const idx = Number(trimmed) - 1;
    if (idx < 0 || idx >= profiles.length) {
      return { error: `Invalid profile number "${trimmed}". Choose 1-${profiles.length}.` };
    }
    return { profile: profiles[idx].id };
  }
  const lower = trimmed.toLowerCase();
  if (VALID_GUIDED_PROFILE_IDS.includes(lower)) {
    return { profile: lower };
  }
  return {
    error: `Unknown profile "${trimmed}". Choose 1-${profiles.length} or one of: ${VALID_GUIDED_PROFILE_IDS.join(', ')}.`,
  };
}

function printCatalogQuickHelp(catalog, writeLine) {
  writeLine('');
  writeLine(`Skills (${catalog.skills.length}): ${catalog.skills.join(', ')}`);
  writeLine(`Agents (${catalog.agents.length}): ${catalog.agents.join(', ')}`);
  writeLine(`Commands (${catalog.commands.length}): ${catalog.commands.join(', ')}`);
  writeLine(`Legacy shims (${catalog.shims.length}): ${catalog.shims.join(', ')}`);
  writeLine('');
}

async function runInteractiveWizard(parsed, runtime) {
  const {
    repoRoot,
    projectRoot,
    homeDir,
    env,
    stdin,
    stdout,
    stderr,
    ask: injectedAsk,
    useColor,
  } = runtime;

  const uiOut = parsed.json ? stderr : stdout;
  const writeLine = (line = '') => uiOut.write(`${line}\n`);
  const color = makeColors(useColor);
  const catalog = discoverCatalog(repoRoot);
  const profiles = listGuidedProfiles(catalog);

  let rl = null;
  const ask = injectedAsk || (async promptText => {
    if (!rl) {
      rl = readline.createInterface({ input: stdin, output: uiOut });
    }
    return rl.question(promptText);
  });

  try {
    writeLine('');
    writeLine(color.bold(color.cyan('ECC Curated — Guided Setup Wizard')));
    writeLine(
      color.dim(
        `Catalog: ${catalog.skills.length} skills · ${catalog.agents.length} agents · `
        + `${catalog.commands.length} commands · ${catalog.shims.length} legacy shims`
      )
    );

    // Step 1: Targets
    let selectedTargets = parsed.targets.length > 0 ? [...parsed.targets] : [];
    let allTargets = Boolean(parsed.allTargets);
    const dest = parsed.dest || null;

    if (dest && selectedTargets.length === 0 && !allTargets) {
      writeLine('');
      writeLine(`Using custom destination (--dest): ${color.cyan(path.resolve(projectRoot, dest))}`);
    } else {
      const targetSnapshots = inspectTargets({ repoRoot, projectRoot, homeDir, env });
      const orderedTargets = SUPPORTED_TARGETS.map(name => {
        const snap = targetSnapshots.find(t => t.target === name);
        return snap;
      });
      const defaultTargets = allTargets
        ? [...CANONICAL_ALL_TARGETS]
        : (selectedTargets.length > 0 ? selectedTargets : ['arena']);

      writeLine('');
      writeLine(color.bold('Step 1/4 — Choose target harness(es):'));
      orderedTargets.forEach((t, idx) => {
        const badge = t.installed
          ? color.green(`[installed: ${t.fileCount} files]`)
          : color.dim('[not installed]');
        writeLine(
          `  ${padRight(`${idx + 1})`, 4)}${padRight(t.target, 16)}`
          + `${padRight(t.locationHint, 20)}${badge}`
        );
      });
      writeLine(`  ${padRight('a)', 4)}${padRight('all', 16)}Install to all 9 unique target roots`);

      const defaultLabel = allTargets ? 'all' : defaultTargets.join(',');
      while (true) {
        const ans = await ask(`Select target numbers or names [${defaultLabel}]: `);
        const res = parseTargetSelection(ans, allTargets ? ['all'] : defaultTargets);
        if (res.error) {
          writeLine(color.red(res.error));
          continue;
        }
        allTargets = res.allTargets;
        selectedTargets = res.targets;
        break;
      }
    }

    // Step 2: Profile & optional custom components
    if (parsed.profile) {
      getGuidedProfile(parsed.profile, catalog);
    }
    const hasCliComponents = parsed.skills.length > 0
      || parsed.agents.length > 0
      || parsed.commands.length > 0
      || parsed.withComponents.length > 0;
    const defaultProfile = parsed.profile || (hasCliComponents ? 'custom' : 'full');

    writeLine('');
    writeLine(color.bold('Step 2/4 — Choose install profile:'));
    profiles.forEach((p, idx) => {
      const counts = p.isCustom
        ? 'manual IDs'
        : `${p.skills.length} skills, ${p.agents.length} agents, ${p.commands.length} cmds`;
      writeLine(
        `  ${padRight(`${idx + 1})`, 4)}${padRight(p.id, 11)}`
        + `${padRight(`(${counts})`, 32)}${color.dim(p.description)}`
      );
    });

    let chosenProfile = defaultProfile;
    while (true) {
      const ans = await ask(`Select profile [${defaultProfile}]: `);
      const res = parseProfileSelection(ans, defaultProfile, profiles);
      if (res.error) {
        writeLine(color.red(res.error));
        continue;
      }
      chosenProfile = res.profile;
      break;
    }

    let skills = [...parsed.skills];
    const agents = [...parsed.agents];
    const commands = [...parsed.commands];
    const withComponents = [...parsed.withComponents];

    if (chosenProfile === 'custom' && !hasCliComponents) {
      writeLine(color.dim('Enter comma-separated skill, agent, command, or shim IDs (type "?" to list all IDs):'));
      while (true) {
        const ans = await ask('Component IDs: ');
        const trimmed = String(ans || '').trim();
        if (trimmed === '?') {
          printCatalogQuickHelp(catalog, writeLine);
          continue;
        }
        const ids = splitTokens(trimmed);
        if (ids.length === 0) {
          writeLine(color.red('Please enter at least one component ID, or type "?" to see available IDs.'));
          continue;
        }
        try {
          createGuidedPlan({
            repoRoot,
            projectRoot,
            homeDir,
            env,
            targets: selectedTargets,
            allTargets,
            dest,
            configPath: parsed.configPath,
            profile: 'custom',
            skills: ids,
            withoutComponents: parsed.withoutComponents,
            includeCanonical: parsed.includeCanonical,
            installShims: parsed.installShims,
            force: parsed.force,
          });
          skills = ids;
          break;
        } catch (err) {
          writeLine(color.red(err.message));
        }
      }
    }

    // Step 3: Legacy shims & overwrite policy
    let installShims = parsed.installShims;
    let includeCanonical = parsed.includeCanonical;
    let force = parsed.force;

    writeLine('');
    writeLine(color.bold('Step 3/4 — Shims & conflict options:'));
    if (installShims === null) {
      while (true) {
        const ans = await ask('Include legacy command shims & canonical skills? [Y/n]: ');
        const yn = parseYesNo(ans, true);
        if (yn === null) {
          writeLine(color.red('Please answer yes (y) or no (n).'));
          continue;
        }
        installShims = yn;
        if (includeCanonical === null) {
          includeCanonical = yn;
        }
        break;
      }
    }

    if (!force) {
      while (true) {
        const ans = await ask('Overwrite unmanaged conflicting files (--force)? [y/N]: ');
        const yn = parseYesNo(ans, false);
        if (yn === null) {
          writeLine(color.red('Please answer yes (y) or no (n).'));
          continue;
        }
        force = yn;
        break;
      }
    }

    // Step 4: Plan preview + confirmation
    const guidedPlan = createGuidedPlan({
      repoRoot,
      projectRoot,
      homeDir,
      env,
      targets: selectedTargets,
      allTargets,
      dest,
      configPath: parsed.configPath,
      profile: chosenProfile,
      skills,
      agents,
      commands,
      withComponents,
      withoutComponents: parsed.withoutComponents,
      includeCanonical,
      installShims,
      force,
    });

    if (parsed.dryRun) {
      if (parsed.json) {
        stdout.write(`${JSON.stringify({ dryRun: true, guidedPlan }, null, 2)}\n`);
      } else {
        stdout.write(formatGuidedPreview(guidedPlan, color));
        stdout.write('Dry run complete. No changes were made.\n');
      }
      return { status: 'preview', guidedPlan };
    }

    writeLine(formatGuidedPreview(guidedPlan, color));

    if (!parsed.yes) {
      while (true) {
        const ans = await ask(`Proceed with installation to ${guidedPlan.targetPlans.length} target(s)? [y/N]: `);
        const yn = parseYesNo(ans, false);
        if (yn === null) {
          writeLine(color.red('Please answer yes (y) or no (n).'));
          continue;
        }
        if (!yn) {
          if (parsed.json) {
            stdout.write(`${JSON.stringify({ cancelled: true, dryRun: false, guidedPlan }, null, 2)}\n`);
          } else {
            stdout.write('Installation cancelled. No changes were made.\n');
          }
          return { status: 'cancelled', guidedPlan };
        }
        break;
      }
    }

    const result = applyGuidedPlan(guidedPlan);
    if (parsed.json) {
      stdout.write(`${JSON.stringify({ dryRun: false, result }, null, 2)}\n`);
    } else {
      stdout.write(formatGuidedApplied(result, color));
    }
    return { status: 'applied', result };
  } finally {
    if (rl) {
      rl.close();
    }
  }
}

async function runNonInteractiveGuided(parsed, runtime) {
  const { repoRoot, projectRoot, homeDir, env, stdout, useColor } = runtime;
  const hasTarget = parsed.targets.length > 0 || parsed.allTargets || Boolean(parsed.dest);
  if (!hasTarget) {
    throw new Error(
      'Non-interactive --guided install requires at least one target '
      + '(--target <name>, --targets <a,b>, --all-targets, or --dest <dir>).\n'
      + 'Example: ecc-install --guided --targets arena,claude-project --profile core --yes\n'
      + `Supported targets: ${SUPPORTED_TARGETS.join(', ')}`
    );
  }

  if (!parsed.dryRun && !parsed.yes) {
    throw new Error(
      'Non-interactive --guided install requires --yes (-y) to write files, or pass --dry-run to preview.'
    );
  }

  const catalog = discoverCatalog(repoRoot);
  if (parsed.profile) {
    getGuidedProfile(parsed.profile, catalog);
  }

  const guidedPlan = createGuidedPlan({
    repoRoot,
    projectRoot,
    homeDir,
    env,
    targets: parsed.targets,
    allTargets: parsed.allTargets,
    dest: parsed.dest,
    configPath: parsed.configPath,
    profile: parsed.profile,
    skills: parsed.skills,
    agents: parsed.agents,
    commands: parsed.commands,
    withComponents: parsed.withComponents,
    withoutComponents: parsed.withoutComponents,
    includeCanonical: parsed.includeCanonical,
    installShims: parsed.installShims,
    force: parsed.force,
  });

  const color = makeColors(useColor && !parsed.json);

  if (parsed.dryRun) {
    if (parsed.json) {
      stdout.write(`${JSON.stringify({ dryRun: true, guidedPlan }, null, 2)}\n`);
    } else {
      stdout.write(formatGuidedPreview(guidedPlan, color));
      stdout.write('Dry run complete. No changes were made.\n');
    }
    return { status: 'preview', guidedPlan };
  }

  const result = applyGuidedPlan(guidedPlan);
  if (parsed.json) {
    stdout.write(`${JSON.stringify({ dryRun: false, result }, null, 2)}\n`);
  } else {
    stdout.write(formatGuidedApplied(result, color));
  }
  return { status: 'applied', result };
}

async function runGuidedInstall(parsed, options = {}) {
  const stdin = options.stdin || process.stdin;
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const isTTY = options.isTTY !== undefined
    ? Boolean(options.isTTY)
    : Boolean(stdin.isTTY && stdout.isTTY);
  const useColor = options.useColor !== undefined
    ? Boolean(options.useColor)
    : Boolean(stdout.isTTY && !process.env.NO_COLOR);

  const runtime = {
    repoRoot: path.resolve(options.repoRoot || DEFAULT_REPO_ROOT),
    projectRoot: path.resolve(options.projectRoot || process.cwd()),
    homeDir: path.resolve(options.homeDir || process.env.HOME || os.homedir()),
    env: options.env || process.env,
    stdin,
    stdout,
    stderr,
    ask: options.ask || null,
    isTTY,
    useColor,
  };

  if (isTTY) {
    return runInteractiveWizard(parsed, runtime);
  }
  return runNonInteractiveGuided(parsed, runtime);
}

module.exports = {
  formatGuidedApplied,
  formatGuidedPreview,
  parseProfileSelection,
  parseTargetSelection,
  runGuidedInstall,
};

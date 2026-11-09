#!/usr/bin/env node
'use strict';

const os = require('os');
const {
  DEFAULT_REPO_ROOT,
  SUPPORTED_TARGETS,
  applyInstallPlan,
  createInstallPlan,
  discoverCatalog,
  parseArgs,
  uninstallFromTarget,
} = require('../lib/ecc-installer');

function getHelpText() {
  return `
Usage:
  ecc-install [--target <target>] [--dest <dir>] [--dry-run] [--json] [--force]
              [--skills <id[,id...]>] [--agents <id[,id...]>] [--commands <id[,id...]>]
              [--with <component[,...]>] [--without <component[,...]>]
              [--no-shims] [--no-canonical] [--config <path>]
  ecc-install --list [--json]
  ecc-install --uninstall [--target <target>] [--dest <dir>] [--dry-run] [--json] [--force]

Note:
  --skills accepts skills, agents, commands, and legacy command shims from this repository
  and resolves each entry to its proper destination directory. Legacy shims also include
  their canonical replacement skills unless --no-canonical is passed.

Targets:
  claude          (default) ~/.claude/
  claude-project  ./.claude/
  arena           ./.agents/ (Arena & cross-agent skills/agents/workflows)
  antigravity     ./.agents/ (commands installed into workflows/)
  cursor          ./.cursor/
  codex           ~/.codex/
  opencode        $OPENCODE_CONFIG_DIR or ~/.config/opencode/
  gemini          ./.gemini/
  kimi            ./.kimi-code/
  copilot         ./.github/

Options:
  --skills <ids>     Comma-separated skill/agent/command/shim IDs to install
  --agents <ids>     Comma-separated agent IDs to install
  --commands <ids>   Comma-separated command or shim IDs to install
  --with <ids>       Include components (supports skill:<id>, agent:<id>, command:<id>, shim:<id>)
  --without <ids>    Exclude components
  --target <name>    Target harness (${SUPPORTED_TARGETS.join(', ')})
  --dest <path>      Custom destination root directory (overrides --target)
  --config <path>    Load defaults/selection from ecc-install.json
  --shims            Install legacy command shim .md files (default: true)
  --no-shims         Skip installing legacy command shim .md files
  --canonical        Install canonical skills referenced by legacy shims (default: true)
  --no-canonical     Do not auto-add canonical skills referenced by legacy shims
  --force            Overwrite pre-existing unmanaged files with different contents
  --dry-run          Preview planned operations without writing files
  --json             Print machine-readable JSON output
  --list             List all available skills, agents, commands, and legacy shims
  --uninstall        Remove unchanged ECC-managed files tracked in install-state.json
  -h, --help         Show this help text
`;
}

function printCatalog(catalog, asJson) {
  if (asJson) {
    console.log(JSON.stringify({
      repoRoot: catalog.repoRoot,
      skills: catalog.skills,
      agents: catalog.agents,
      commands: catalog.commands,
      legacyShims: catalog.shimCanonicalMap,
    }, null, 2));
    return;
  }

  console.log(`ECC curated catalog (${catalog.repoRoot}):\n`);
  console.log(`Skills (${catalog.skills.length}):`);
  console.log(`  ${catalog.skills.join(', ')}\n`);
  console.log(`Agents (${catalog.agents.length}):`);
  console.log(`  ${catalog.agents.join(', ')}\n`);
  console.log(`Commands (${catalog.commands.length}):`);
  console.log(`  ${catalog.commands.join(', ')}\n`);
  console.log(`Legacy command shims (${catalog.shims.length}):`);
  for (const shimId of catalog.shims) {
    const canonical = catalog.shimCanonicalMap[shimId] || [];
    console.log(`  ${shimId} -> ${canonical.join(', ') || '(none)'}`);
  }
}

function printHumanResult(result, dryRun) {
  const counts = result.summary || {
    total: result.operations.length,
    created: result.operations.filter(op => op.action === 'create').length,
    updated: result.operations.filter(op => op.action === 'update').length,
    unchanged: result.operations.filter(op => op.action === 'unchanged').length,
    skipped: result.operations.filter(op => op.action === 'skip-conflict').length,
  };

  console.log(`${dryRun ? 'Dry-run install plan' : 'ECC install complete'}:\n`);
  console.log(`Mode: ${result.mode}`);
  console.log(`Target: ${result.target}`);
  console.log(`Install root: ${result.targetRoot}`);
  console.log(`Install state: ${result.installStatePath}`);
  if (result.configPath) {
    console.log(`Config: ${result.configPath}`);
  }
  console.log(
    `Selected: ${result.selection.skills.length} skills, `
    + `${result.selection.agents.length} agents, `
    + `${result.selection.commands.length} commands, `
    + `${result.selection.shims.length} legacy shims`
  );

  const aliases = result.resolvedAliases || {};
  if (aliases.agentsFromSkillsFlag?.length) {
    console.log(`Resolved agents from --skills: ${aliases.agentsFromSkillsFlag.join(', ')}`);
  }
  if (aliases.commandsFromSkillsFlag?.length) {
    console.log(`Resolved commands from --skills: ${aliases.commandsFromSkillsFlag.join(', ')}`);
  }
  if (aliases.shimsFromSkillsFlag?.length) {
    console.log(`Resolved legacy shims from --skills: ${aliases.shimsFromSkillsFlag.join(', ')}`);
  }
  if (aliases.canonicalAddedFromShims?.length) {
    const mapped = aliases.canonicalAddedFromShims.map(m => `${m.shim} -> ${m.skill}`).join(', ');
    console.log(`Included canonical skills for shims: ${mapped}`);
  }

  console.log(
    `Operations (${counts.total}): `
    + `${counts.created} create, ${counts.updated} update, `
    + `${counts.unchanged} unchanged, ${counts.skipped} skipped`
  );

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  console.log(`\n${dryRun ? 'Planned' : 'Processed'} files:`);
  for (const op of result.operations) {
    console.log(`- [${op.action}] ${op.sourceRelativePath} -> ${op.destinationPath}`);
  }

  if (!dryRun) {
    console.log(`\nDone. State written to ${result.installStatePath}`);
  }
}

function printHumanUninstall(result, dryRun) {
  console.log(`${dryRun ? 'Dry-run uninstall plan' : 'ECC uninstall complete'}:\n`);
  console.log(`Target: ${result.target}`);
  console.log(`Install root: ${result.targetRoot}`);
  console.log(`Removed: ${result.removed.length}`);
  console.log(`Preserved (modified/unmanaged): ${result.preserved.length}`);
  for (const filePath of result.removed) {
    console.log(`- [remove] ${filePath}`);
  }
  for (const filePath of result.preserved) {
    console.log(`- [preserve] ${filePath}`);
  }
}

function main() {
  try {
    const parsed = parseArgs(process.argv);

    if (parsed.help) {
      console.log(getHelpText());
      return;
    }

    const repoRoot = DEFAULT_REPO_ROOT;
    const projectRoot = process.cwd();
    const homeDir = process.env.HOME || os.homedir();

    if (parsed.list) {
      const catalog = discoverCatalog(repoRoot);
      printCatalog(catalog, parsed.json);
      return;
    }

    if (parsed.uninstall) {
      const uninstallResult = uninstallFromTarget({
        repoRoot,
        projectRoot,
        homeDir,
        env: process.env,
        target: parsed.target,
        dest: parsed.dest,
        configPath: parsed.configPath,
        dryRun: parsed.dryRun,
        force: parsed.force,
      });
      if (parsed.json) {
        console.log(JSON.stringify({ dryRun: parsed.dryRun, uninstall: uninstallResult }, null, 2));
      } else {
        printHumanUninstall(uninstallResult, parsed.dryRun);
      }
      return;
    }

    const plan = createInstallPlan({
      repoRoot,
      projectRoot,
      homeDir,
      env: process.env,
      target: parsed.target,
      dest: parsed.dest,
      configPath: parsed.configPath,
      skills: parsed.skills,
      agents: parsed.agents,
      commands: parsed.commands,
      withComponents: parsed.withComponents,
      withoutComponents: parsed.withoutComponents,
      includeCanonical: parsed.includeCanonical,
      installShims: parsed.installShims,
      force: parsed.force,
    });

    if (parsed.dryRun) {
      if (parsed.json) {
        console.log(JSON.stringify({ dryRun: true, plan }, null, 2));
      } else {
        printHumanResult(plan, true);
      }
      return;
    }

    const result = applyInstallPlan(plan);
    if (parsed.json) {
      console.log(JSON.stringify({ dryRun: false, result }, null, 2));
    } else {
      printHumanResult(result, false);
    }
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();

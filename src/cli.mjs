import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = JSON.parse(
  await readFile(join(PACKAGE_ROOT, 'package.json'), 'utf8'),
);
const MANIFEST_FILE = '.frontend-openspec.json';

const HELP = `frontend-openspec <command> [options]

Commands:
  init       Add the standards to a React or Vue project
  check      Validate installation and OpenSpec document structure
  upgrade    Refresh managed files without overwriting local edits

Options:
  --dir <path>                Target project, defaults to the current directory
  --framework <react|vue>     Override framework detection
  --package-manager <name>    Override package-manager detection
  --source-dir <path>         Source directory, defaults to src
  --force                     Replace existing files during init
  --dry-run                   Report file operations without writing
  --version                   Show package version
  --help                      Show this message`;

function parseArgs(argv) {
  const [command = 'help', ...tokens] = argv;
  const options = { dir: process.cwd(), dryRun: false, force: false };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--force') options.force = true;
    else if (token === '--dry-run') options.dryRun = true;
    else if (token === '--version') options.version = true;
    else if (token === '--help') options.help = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      const value = tokens[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${token} requires a value`);
      options[key] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  options.dir = resolve(options.dir);
  return { command, options };
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Cannot parse ${path}: ${error.message}`);
  }
}

function detectFramework(packageJson, requested) {
  if (requested) {
    if (!['react', 'vue'].includes(requested)) {
      throw new Error('--framework must be react or vue');
    }
    return requested;
  }

  const dependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
  };
  const reactSignals = [
    'react',
    'react-dom',
    '@types/react',
    '@vitejs/plugin-react',
    '@vitejs/plugin-react-swc',
    'next',
    '@umijs/max',
    'umi',
    'react-router-dom',
  ];
  const vueSignals = [
    'vue',
    '@vue/runtime-core',
    '@vitejs/plugin-vue',
    'nuxt',
    'vue-router',
  ];
  const reactScore = reactSignals.filter((name) => dependencies[name]).length;
  const vueScore = vueSignals.filter((name) => dependencies[name]).length;
  if (reactScore > vueScore) return 'react';
  if (vueScore > reactScore) return 'vue';
  throw new Error('Cannot detect one framework. Pass --framework react or --framework vue.');
}

function detectPackageManager(projectDir, packageJson, requested) {
  if (requested) {
    if (!['pnpm', 'npm', 'yarn', 'bun'].includes(requested)) {
      throw new Error('--package-manager must be pnpm, npm, yarn or bun');
    }
    return requested;
  }
  const declared = packageJson?.packageManager?.split('@')[0];
  if (declared) return declared;
  if (existsSync(join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectDir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(projectDir, 'bun.lockb')) || existsSync(join(projectDir, 'bun.lock'))) return 'bun';
  return 'npm';
}

function commandFor(packageManager, script, scripts) {
  if (!scripts?.[script]) return '';
  if (packageManager === 'npm' || packageManager === 'bun') {
    return `${packageManager} run ${script}`;
  }
  return `${packageManager} ${script}`;
}

function templateValues(projectDir, packageJson, options) {
  const framework = detectFramework(packageJson, options.framework);
  const packageManager = detectPackageManager(
    projectDir,
    packageJson,
    options.packageManager,
  );
  const scripts = packageJson?.scripts ?? {};
  return {
    framework,
    packageManager,
    projectName: packageJson?.name ?? projectDir.split(/[\\/]/).at(-1),
    sourceDir: options.sourceDir ?? 'src',
    devCommand: commandFor(packageManager, 'dev', scripts),
    lintCommand: commandFor(packageManager, 'lint', scripts),
    testCommand: commandFor(packageManager, 'test', scripts),
    typecheckCommand:
      commandFor(packageManager, 'typecheck', scripts) ||
      commandFor(packageManager, 'type-check', scripts),
  };
}

function renderTemplate(content, values) {
  return content.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    const map = {
      FRAMEWORK: values.framework,
      PACKAGE_MANAGER: values.packageManager,
      PROJECT_NAME: values.projectName,
      SOURCE_DIR: values.sourceDir,
      DEV_COMMAND: values.devCommand || '未配置',
      LINT_COMMAND: values.lintCommand || '未配置',
      TEST_COMMAND: values.testCommand || '未配置',
      TYPECHECK_COMMAND: values.typecheckCommand || '未配置',
    };
    return map[key] ?? '';
  });
}

async function listFiles(root, prefix = '') {
  const folder = join(root, prefix);
  if (!existsSync(folder)) return [];
  const entries = await readdir(folder, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, next)));
    else files.push(next);
  }
  return files;
}

async function templateMap(framework) {
  const groups = [
    ['core', '.agents/rules'],
    [`profiles/${framework}`, '.agents/rules'],
    ['agents', '.'],
    ['project', '.'],
  ];
  const files = [];
  for (const [templateFolder, targetFolder] of groups) {
    const root = join(PACKAGE_ROOT, 'templates', templateFolder);
    for (const sourceRelative of await listFiles(root)) {
      files.push({
        source: join(root, sourceRelative),
        target: join(targetFolder, sourceRelative),
      });
    }
  }
  return files;
}

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function runOpenSpec(args, cwd) {
  return spawnSync('openspec', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

async function writeManagedFile(projectDir, targetRelative, content, options) {
  const target = join(projectDir, targetRelative);
  const existed = existsSync(target);
  if (existed && !options.force) {
    const current = await readFile(target, 'utf8');
    if (current === content) {
      return { status: 'unchanged', targetRelative, managed: true };
    }
    const candidateRelative = `${targetRelative}.frontend-openspec-new`;
    if (!options.dryRun) await writeFile(`${target}.frontend-openspec-new`, content, 'utf8');
    return { status: 'conflict', targetRelative: candidateRelative, managed: false };
  }
  if (!options.dryRun) {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  return {
    status: existed ? 'updated' : 'created',
    targetRelative,
    managed: true,
  };
}

async function initProject(options) {
  const projectDir = options.dir;
  const manifestPath = join(projectDir, MANIFEST_FILE);
  if (existsSync(manifestPath) && !options.force) {
    throw new Error(`${MANIFEST_FILE} exists. Use upgrade or pass --force.`);
  }
  const packageJson = await readJson(join(projectDir, 'package.json'));
  if (!packageJson) throw new Error(`No package.json found in ${projectDir}`);
  const values = templateValues(projectDir, packageJson, options);
  const mappings = await templateMap(values.framework);
  const managedFiles = {};
  const results = [];

  for (const mapping of mappings) {
    const raw = await readFile(mapping.source, 'utf8');
    const content = renderTemplate(raw, values);
    const targetRelative = mapping.target.replaceAll('\\', '/').replace(/^\.\//, '');
    const result = await writeManagedFile(projectDir, targetRelative, content, options);
    results.push(result);
    if (result.managed) managedFiles[targetRelative] = hash(content);
  }

  const manifest = {
    schemaVersion: 1,
    packageVersion: PACKAGE_JSON.version,
    framework: values.framework,
    packageManager: values.packageManager,
    sourceDir: values.sourceDir,
    commands: {
      dev: values.devCommand,
      lint: values.lintCommand,
      test: values.testCommand,
      typecheck: values.typecheckCommand,
    },
    managedFiles,
  };
  if (!options.dryRun) {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }
  printResults('Initialized', projectDir, results);
}

async function upgradeProject(options) {
  const projectDir = options.dir;
  const manifestPath = join(projectDir, MANIFEST_FILE);
  const manifest = await readJson(manifestPath);
  if (!manifest) throw new Error(`Run init first: ${MANIFEST_FILE} is missing`);
  const packageJson = await readJson(join(projectDir, 'package.json'));
  const values = templateValues(projectDir, packageJson, {
    ...options,
    framework: manifest.framework,
    packageManager: manifest.packageManager,
    sourceDir: manifest.sourceDir,
  });
  const results = [];
  const nextManagedFiles = { ...manifest.managedFiles };

  for (const mapping of await templateMap(values.framework)) {
    const targetRelative = mapping.target.replaceAll('\\', '/').replace(/^\.\//, '');
    const target = join(projectDir, targetRelative);
    const content = renderTemplate(await readFile(mapping.source, 'utf8'), values);
    const previousHash = manifest.managedFiles[targetRelative];

    if (!existsSync(target)) {
      if (!options.dryRun) {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, 'utf8');
      }
      nextManagedFiles[targetRelative] = hash(content);
      results.push({ status: 'created', targetRelative });
      continue;
    }

    const current = await readFile(target, 'utf8');
    if (current === content) {
      nextManagedFiles[targetRelative] = hash(content);
      results.push({ status: 'unchanged', targetRelative });
      continue;
    }
    if (options.force || (previousHash && hash(current) === previousHash)) {
      if (!options.dryRun) await writeFile(target, content, 'utf8');
      nextManagedFiles[targetRelative] = hash(content);
      results.push({ status: 'updated', targetRelative });
      continue;
    }

    const candidate = `${target}.frontend-openspec-new`;
    if (!options.dryRun) await writeFile(candidate, content, 'utf8');
    results.push({
      status: 'conflict',
      targetRelative: `${targetRelative}.frontend-openspec-new`,
    });
  }

  if (!options.dryRun) {
    const nextManifest = {
      ...manifest,
      packageVersion: PACKAGE_JSON.version,
      commands: {
        dev: values.devCommand,
        lint: values.lintCommand,
        test: values.testCommand,
        typecheck: values.typecheckCommand,
      },
      managedFiles: nextManagedFiles,
    };
    const temporary = `${manifestPath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');
    await rename(temporary, manifestPath);
  }
  printResults('Upgraded', projectDir, results);
}

async function collectSpecFiles(projectDir) {
  const root = join(projectDir, 'openspec');
  return (await listFiles(root)).filter((file) => /(^|[\\/])spec\.md$/.test(file));
}

async function checkProject(options) {
  const projectDir = options.dir;
  const manifest = await readJson(join(projectDir, MANIFEST_FILE));
  const errors = [];
  const warnings = [];
  if (!manifest) errors.push(`${MANIFEST_FILE} is missing`);
  if (manifest && !['react', 'vue'].includes(manifest.framework)) {
    errors.push('manifest framework must be react or vue');
  }
  if (manifest && manifest.schemaVersion !== 1) {
    errors.push('manifest schemaVersion must be 1');
  }
  if (manifest && (!manifest.managedFiles || typeof manifest.managedFiles !== 'object')) {
    errors.push('manifest managedFiles must be an object');
  }

  const required = [
    'openspec/config.yaml',
    '.agents/rules/00-index.md',
    '.agents/rules/90-project-overrides.md',
    '.agents/skills/frontend-change/SKILL.md',
    'AGENTS.md',
    'CLAUDE.md',
  ];
  if (manifest?.framework) required.push(`.agents/rules/10-${manifest.framework}.md`);
  for (const file of required) {
    if (!existsSync(join(projectDir, file))) errors.push(`missing ${file}`);
  }

  for (const entryFile of ['AGENTS.md', 'CLAUDE.md']) {
    const path = join(projectDir, entryFile);
    if (existsSync(path)) {
      const content = await readFile(path, 'utf8');
      if (!content.includes('.agents/rules/')) {
        errors.push(`${entryFile} must point to .agents/rules/`);
      }
    }
  }

  for (const skillFile of [
    '.agents/skills/frontend-change/SKILL.md',
  ]) {
    const path = join(projectDir, skillFile);
    if (existsSync(path)) {
      const content = await readFile(path, 'utf8');
      if (!/^---\r?\nname: [a-z0-9-]+\r?\ndescription: .+\r?\n---/m.test(content)) {
        errors.push(`${skillFile} has invalid skill frontmatter`);
      }
    }
  }

  const configPath = join(projectDir, 'openspec/config.yaml');
  if (existsSync(configPath)) {
    const config = await readFile(configPath, 'utf8');
    if (!/^schema:\s+spec-driven\s*$/m.test(config)) {
      errors.push('openspec/config.yaml must declare schema: spec-driven');
    }
  }

  const openspecVersion = runOpenSpec(['--version'], projectDir);
  if (openspecVersion.error?.code === 'ENOENT') {
    warnings.push(
      'official OpenSpec CLI is not installed; install @fission-ai/openspec and run openspec init',
    );
  } else if (openspecVersion.status !== 0) {
    warnings.push('official OpenSpec CLI did not return a version');
  } else {
    const version = openspecVersion.stdout.trim() || openspecVersion.stderr.trim();
    console.log(`OpenSpec ${version}`);
    const schemaResult = runOpenSpec(
      ['schema', 'which', 'spec-driven', '--json'],
      projectDir,
    );
    if (schemaResult.status === 0) {
      try {
        const schema = JSON.parse(schemaResult.stdout);
        if (schema.source && schema.source !== 'package') {
          warnings.push(
            `spec-driven resolves from ${schema.source}, not the official package schema`,
          );
        }
      } catch {
        warnings.push('cannot parse OpenSpec schema resolution output');
      }
    } else {
      warnings.push('installed OpenSpec CLI cannot report schema resolution; consider updating it');
    }
  }

  for (const relativePath of await collectSpecFiles(projectDir)) {
    const content = await readFile(join(projectDir, 'openspec', relativePath), 'utf8');
    const displayPath = `openspec/${relativePath.replaceAll('\\', '/')}`;
    if (!/^### Requirement:/m.test(content)) warnings.push(`${displayPath}: no Requirement`);
    if (!/^#### Scenario:/m.test(content)) errors.push(`${displayPath}: no Scenario`);
    if (!/- \*\*WHEN\*\*/m.test(content)) errors.push(`${displayPath}: no WHEN step`);
    if (!/- \*\*THEN\*\*/m.test(content)) errors.push(`${displayPath}: no THEN step`);
  }

  console.log(`Checked ${projectDir}`);
  for (const warning of warnings) console.warn(`WARN  ${warning}`);
  for (const error of errors) console.error(`ERROR ${error}`);
  if (errors.length) {
    process.exitCode = 1;
    return { errors, warnings };
  }
  console.log(`OK    ${required.length} required files and OpenSpec structure`);
  return { errors, warnings };
}

function printResults(action, projectDir, results) {
  console.log(`${action} ${projectDir}`);
  for (const result of results) {
    console.log(`${result.status.toUpperCase().padEnd(8)} ${result.targetRelative}`);
  }
}

export async function run(argv) {
  const { command, options } = parseArgs(argv);
  if (options.version || command === 'version' || command === '--version') {
    console.log(PACKAGE_JSON.version);
    return;
  }
  if (options.help || command === 'help' || command === '--help') {
    console.log(HELP);
    return;
  }
  if (command === 'init') return initProject(options);
  if (command === 'check') return checkProject(options);
  if (command === 'upgrade') return upgradeProject(options);
  throw new Error(`Unknown command: ${command}\n\n${HELP}`);
}

export { checkProject, initProject, upgradeProject };

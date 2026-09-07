import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { checkProject, initProject, upgradeProject } from '../src/cli.mjs';

async function fixture(framework) {
  const projectDir = await mkdtemp(join(tmpdir(), 'frontend-openspec-'));
  const dependencies = framework === 'react' ? { react: '^19.0.0' } : { vue: '^3.5.0' };
  await writeFile(
    join(projectDir, 'package.json'),
    `${JSON.stringify(
      {
        name: `${framework}-fixture`,
        packageManager: 'pnpm@10.0.0',
        scripts: { dev: 'vite', lint: 'eslint .', test: 'vitest' },
        dependencies,
      },
      null,
      2,
    )}\n`,
  );
  return projectDir;
}

test('init detects React and creates a valid installation', async () => {
  const projectDir = await fixture('react');
  await initProject({ dir: projectDir, dryRun: false, force: false });

  const manifest = JSON.parse(
    await readFile(join(projectDir, '.frontend-openspec.json'), 'utf8'),
  );
  assert.equal(manifest.framework, 'react');
  assert.equal(manifest.packageManager, 'pnpm');
  assert.match(
    await readFile(join(projectDir, 'openspec', 'config.yaml'), 'utf8'),
    /前端框架：react/,
  );
  assert.match(
    await readFile(join(projectDir, '.agents', 'rules', '10-react.md'), 'utf8'),
    /^# React Profile/m,
  );

  const result = await checkProject({ dir: projectDir });
  assert.deepEqual(result.errors, []);
});

test('init detects Vue and uses npm commands when no package manager is declared', async () => {
  const projectDir = await fixture('vue');
  const packageJsonPath = join(projectDir, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  delete packageJson.packageManager;
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  await initProject({ dir: projectDir, dryRun: false, force: false });
  const overrides = await readFile(
    join(projectDir, '.agents', 'rules', '90-project-overrides.md'),
    'utf8',
  );
  assert.match(overrides, /npm run lint/);
  assert.match(
    await readFile(join(projectDir, '.agents', 'rules', '10-vue.md'), 'utf8'),
    /^# Vue Profile/m,
  );
});

test('init recognizes a React meta-framework without a direct react dependency', async () => {
  const projectDir = await fixture('react');
  const packageJsonPath = join(projectDir, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  packageJson.dependencies = { '@umijs/max': '^4.0.0' };
  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  await initProject({ dir: projectDir, dryRun: false, force: false });
  const manifest = JSON.parse(
    await readFile(join(projectDir, '.frontend-openspec.json'), 'utf8'),
  );
  assert.equal(manifest.framework, 'react');
});

test('upgrade preserves local edits and writes a review candidate', async () => {
  const projectDir = await fixture('react');
  await initProject({ dir: projectDir, dryRun: false, force: false });
  const target = join(projectDir, '.agents', 'rules', '01-engineering-baseline.md');
  await writeFile(target, '# Local policy\n');

  await upgradeProject({ dir: projectDir, dryRun: false, force: false });

  assert.equal(await readFile(target, 'utf8'), '# Local policy\n');
  assert.match(
    await readFile(`${target}.frontend-openspec-new`, 'utf8'),
    /^# 工程基线/m,
  );
});

test('init preserves an existing Agent entry and writes a merge candidate', async () => {
  const projectDir = await fixture('react');
  await writeFile(join(projectDir, 'AGENTS.md'), '# Existing repository rules\n');

  await initProject({ dir: projectDir, dryRun: false, force: false });

  assert.equal(
    await readFile(join(projectDir, 'AGENTS.md'), 'utf8'),
    '# Existing repository rules\n',
  );
  assert.match(
    await readFile(join(projectDir, 'AGENTS.md.frontend-openspec-new'), 'utf8'),
    /\.agents\/rules\//,
  );
  const manifest = JSON.parse(
    await readFile(join(projectDir, '.frontend-openspec.json'), 'utf8'),
  );
  assert.equal(manifest.managedFiles['AGENTS.md'], undefined);
});

test('check rejects a malformed OpenSpec scenario', async () => {
  const projectDir = await fixture('react');
  await initProject({ dir: projectDir, dryRun: false, force: false });
  const specPath = join(projectDir, 'openspec', 'specs', 'sample', 'spec.md');
  await mkdir(join(projectDir, 'openspec', 'specs', 'sample'), { recursive: true });
  await writeFile(specPath, '### Requirement: sample\n');

  const originalExitCode = process.exitCode;
  const result = await checkProject({ dir: projectDir });
  process.exitCode = originalExitCode;
  assert.ok(result.errors.some((error) => error.includes('no Scenario')));
});

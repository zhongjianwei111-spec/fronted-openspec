# frontend-openspec-kit

`frontend-openspec-kit` 为 React 和 Vue 项目安装一套共享的工程规范。Codex、Claude Code、Cursor、Gemini 和 GitHub Copilot 通过各自的薄入口读取同一份 `.agents/rules/`，OpenSpec 负责记录行为变更的提案、规格、设计和任务。

## 要求

- Node.js 20.19 或更高版本
- React 或 Vue 项目
- 项目根目录包含 `package.json`
- 官方 OpenSpec CLI：`@fission-ai/openspec`

## 使用

先安装并初始化官方 OpenSpec。工具列表按团队使用的 Agent 调整：

```bash
npm install -g @fission-ai/openspec@latest
openspec init --tools codex,claude,cursor
```

再安装前端工程规范：

```bash
pnpm dlx frontend-openspec-kit init
pnpm dlx frontend-openspec-kit check
pnpm dlx frontend-openspec-kit upgrade
```

在本仓库开发时运行：

```bash
node ./bin/frontend-openspec.mjs init --dir ../my-project
node ./bin/frontend-openspec.mjs check --dir ../my-project
node ./bin/frontend-openspec.mjs upgrade --dir ../my-project
```

框架检测不明确时显式传入 Profile：

```bash
pnpm dlx frontend-openspec-kit init --framework react
pnpm dlx frontend-openspec-kit init --framework vue
```

CLI 会读取 `package.json` 和锁文件，检测包管理器与可用的 `dev`、`lint`、`test`、`typecheck` 脚本。缺失命令写为“未配置”，不会生成替代命令。

## 生成内容

```text
project/
├── openspec/
│   ├── config.yaml
│   ├── specs/
│   └── changes/
├── .agents/
│   ├── rules/
│   └── skills/frontend-change/
├── .cursor/rules/openspec.mdc
├── .github/copilot-instructions.md
├── .frontend-openspec.json
├── AGENTS.md
├── CLAUDE.md
└── GEMINI.md
```

规则按以下优先级执行：

1. 用户在当前任务中的明确要求
2. 仓库的 `AGENTS.md` 硬约束
3. `.agents/rules/90-project-overrides.md`
4. React 或 Vue Profile
5. 通用规则

团队只在 `90-project-overrides.md` 中记录项目差异。Agent 入口不复制详细规则。

## 安全升级

`.frontend-openspec.json` 保存工具版本、项目选择和受管文件哈希。`upgrade` 只覆盖上次安装后没有变化的受管文件。项目修改过的文件会保留，工具把新版写入同目录的 `*.frontend-openspec-new` 文件供人工合并。`init` 遇到已有 Agent 入口或规则时也采用这一方式，不覆盖项目内容。

`--force` 会覆盖已有规则和入口文件。使用前请确认仓库改动可恢复。

## OpenSpec 约定

工具使用 OpenSpec 内置的 `spec-driven` schema：

```text
proposal → specs + design → tasks → apply → archive
```

新增或修改预期的用户可观察行为、公共契约或跨模块能力需要 OpenSpec change。局部缺陷修复如果只恢复已有规格或已经明确的预期行为，可以直接实现并完成针对性验证；诊断、纯文档、文案、样式微调和不改变行为的重构也不强制创建 change。已有相关 change 时继续使用，不重复创建提案。

`openspec/config.yaml` 通过 `schema: spec-driven` 解析官方 CLI 内置 schema，本工具包不复制该 schema。两套内容分开升级：

```bash
openspec update
pnpm dlx frontend-openspec-kit@latest upgrade
```

团队在 `package.json`、Volta、mise 或 CI 镜像中锁定 OpenSpec 版本。升级官方 CLI 后先运行 `openspec update`、`openspec validate` 和 `frontend-openspec check`，再提交生成文件。

参考：[OpenSpec spec-driven schema](https://openspec.dev/docs/schemas/spec-driven) 和 [项目配置](https://openspec.dev/docs/configuration/config-yaml)。

## 开发验证

```bash
pnpm run check
pnpm test
```

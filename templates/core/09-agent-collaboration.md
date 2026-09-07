# Agent 协作规范

- `.agents/rules/` 是工程规则的唯一事实源。`AGENTS.md`、`CLAUDE.md` 和编辑器规则只提供入口和项目硬约束。
- Agent 开始任务时读取 `00-index.md`、`90-project-overrides.md` 和任务涉及的规则。
- 涉及用户可观察行为、公共契约或多模块改动时，通过 OpenSpec change 记录需求、设计和任务。
- 同一任务中的 Agent 共享变更目录，不创建内容重复的提案。
- 每个 Agent 声明自己负责的文件范围，避免同时编辑同一文件。无法划分时由一个 Agent完成写入，其他 Agent只做只读检查。
- Agent 交付时列出改动、验证结果、未解决风险和需要用户决定的事项。
- Agent 不把聊天中的临时推测写成长期规范。项目负责人通过 `90-project-overrides.md` 或正式 OpenSpec change 固化决策。

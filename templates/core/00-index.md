# 前端工程规范索引

Agent 在修改代码前按任务读取相关文件，不需要把全部规范载入上下文。

## 优先级

1. 用户在当前任务中的明确要求
2. 项目根目录 `AGENTS.md` 中的仓库约束
3. `.agents/rules/90-project-overrides.md` 中的项目约束
4. 当前框架 Profile：`10-react.md` 或 `10-vue.md`
5. 本目录中的通用规范

低优先级规则与高优先级规则冲突时，Agent 遵守高优先级规则，并在交付说明中指出冲突。

## 按任务读取

| 任务 | 规范 |
| --- | --- |
| 组件、页面、Hooks、Composables | `03-components.md` + 框架 Profile |
| 接口、缓存、表单提交 | `04-data-api.md` |
| 状态、路由 | `05-state-routing.md` + 框架 Profile |
| 样式、交互、无障碍 | `06-styles-a11y.md` |
| 测试、验证、缺陷修复 | `07-testing-validation.md` |
| 依赖、权限、敏感数据 | `08-security-dependencies.md` |
| 多 Agent 协作 | `09-agent-collaboration.md` |

## 流程分级

- 局部缺陷修复、诊断、纯重构、文案或样式微调：直接使用对应 Skill 和相关规则，不要求创建 OpenSpec change。缺陷修复以恢复已经明确或已有规格约定的行为为限。
- 新增或修改预期的用户可观察行为、公共契约，或涉及多个模块的能力变更：使用官方 OpenSpec 安装的 propose、apply、verify 和 archive 工作流。
- 已有相关 OpenSpec change 时继续使用该 change，不为同一行为重复创建提案。

普通实现任务读取 `.agents/skills/frontend-change/SKILL.md`。难复现、反复出现或涉及竞态的缺陷再使用专项诊断流程；简单缺陷不强制套用完整诊断阶段。

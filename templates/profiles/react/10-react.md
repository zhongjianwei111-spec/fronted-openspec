# React Profile

- 使用函数组件和项目现有 Hooks 约定，不新增 class 组件。
- Hook 只在组件或自定义 Hook 顶层调用。自定义 Hook 使用 `use` 前缀，并返回稳定、可理解的契约。
- `useEffect` 只同步 React 与外部系统。可在渲染或事件处理器完成的逻辑不放入 Effect。
- Effect 声明完整依赖并提供清理函数。不要通过关闭 lint 规则掩盖闭包或依赖问题。
- 状态更新依赖旧值时使用函数式更新；对象和数组保持不可变更新。
- Context 用于稳定的跨层依赖。高频变化或大范围业务状态使用项目已有 Store。
- 使用 `useMemo`、`useCallback` 和 `memo` 前先确认可测量的渲染成本或引用稳定需求。
- 列表、Suspense、Error Boundary 和服务端渲染能力遵循项目框架约定。

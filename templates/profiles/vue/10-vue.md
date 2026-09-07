# Vue Profile

- Vue 3 项目优先使用 Composition API 和项目已有的 `<script setup>` 约定。
- props 保持只读；子组件通过 emit、`v-model` 契约或共享 Store 请求父级更新。
- 使用 `computed` 表达派生值，使用 `watch` 或 `watchEffect` 处理与外部系统同步的副作用。
- `watch` 指定准确数据源和必要的触发选项，组件卸载时清理手工创建的订阅与监听。
- `ref` 用于可替换值，`reactive` 用于结构稳定的对象；解构响应式对象时保留响应性。
- Composable 使用 `use` 前缀，明确输入、返回值、生命周期和是否共享实例。
- Pinia 或其他 Store 只保存跨组件或跨页面状态；服务器数据沿用项目已有缓存方案。
- 模板中的表达式保持简短，复杂转换移到 `computed` 或函数。

# UniSpeaking 架构文档

这组文档把“现有代码事实”和“Agent 化升级设计”分开，避免把建议中的模块误认为已经实现。

## 文档入口

1. [01-current-architecture.md](01-current-architecture.md)：当前 Java、Web、Realtime、Session、AI Provider、Scene、Evaluation、数据库和前端路由的事实梳理。
2. [02-agent-upgrade-architecture.md](02-agent-upgrade-architecture.md)：在现有架构上做小步升级，将自由聊天改造成可创建的个性化 Agent，并把场景广场融合为模板/创建向导。

## 阅读顺序

```text
现有代码事实
  -> 01-current-architecture.md
  -> 目标产品对象和边界
  -> 02-agent-upgrade-architecture.md
  -> Phase 0 ~ Phase 4 逐步实施
```

## 设计基线

- Java 继续负责认证、权限、数据库、WebRTC 控制面、WebSocket Session 和领域业务。
- `AiProviderRegistry` 继续作为统一 AI 能力入口。
- `SessionLifecycleManager`、`RealtimeSessionCoordinator` 和 `SessionMessageDispatcher` 继续作为统一 Session/实时基础设施。
- Agent 是持久化的陪练配置和工作区，不是另一套实时通信技术栈。
- IELTS 和 Interview 在导航上独立，在基础设施上复用，在题目/材料/评价规则上保持专用。
- 旧 Custom Scene 和旧 FreeChat 接口保留兼容，逐步迁移，不一次性删除或重写。
- 长期记忆只有用户确认后才写入，并且只能将已确认事实注入 Prompt。


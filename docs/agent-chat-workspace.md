# Saved Agent conversations

Saved Agents open their latest meaningful conversation, not the prompt editor. The chat header offers History, New conversation and Edit settings. Settings are edited in an accessible drawer and apply to the next new conversation. Continuing an existing conversation uses its immutable snapshot.

## Persistence

`agent_chat_thread` owns a logical conversation, its user, stable Agent ID, and settings snapshot. Existing `agent_conversation` rows remain practice / voice segments, linked by `thread_id` and ordered by `segment_order`. `session_message` and learning-material source IDs are preserved. Multiple voice connections and text turns can belong to one logical conversation.

V13 migrates each existing Agent session into a separate thread without changing its messages. V14 adds recoverable voice-quota reservations. V15 provides monotonic segment ordering when timestamps are equal. Existing session URLs remain readable. Unassociated legacy sessions are shown separately and are never assigned to an Agent by guessing its name.

Opening an Agent, history or settings does not allocate a practice session, open the microphone or call an AI model. Text threads are allocated lazily on sending; retries reuse a request ID. Empty or failed records cannot replace a meaningful conversation as the default.

## API

All endpoints are under `/api/agent-workspace`, require authentication and check user ownership.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/agents/{id}/open` | Get the latest saved Agent and its last meaningful conversation; remember the selected Agent |
| POST | `/threads` | Idempotently prepare a thread using `{config, requestId}` |
| GET | `/threads?agentId=…&offset=0` | Page through 50 summaries; optional Agent filter; meaningful records first |
| GET | `/threads/{id}` | Get the snapshot, ordered messages, practice segments and learning items |
| POST | `/threads/{id}/open` | Read and remember this conversation |
| POST | `/threads/{id}/messages` | Continue in text using `{requestId, text}`; duplicate requests do not repeat model calls or messages |
| POST | `/threads/{id}/end` | End the latest practice segment; retain the logical conversation for continuation |
| POST | `/conversations/{sessionId}/transcripts` | Save / retry `{eventId, owner, text}` exactly once |
| GET | `/legacy-conversations` | List saved legacy sessions without Agent metadata |

`POST /api/scene-sessions` additionally accepts `conversationId` for voice continuation. The server reads the stored snapshot and replay context, and creates a fresh actual media session. Supplied voice overrides cannot replace the stored voice when continuing. A second voice connection or a text write cannot interrupt an active voice segment in that thread.

Replay context is limited to the latest 24 messages and 12,000 characters. It never includes unrelated Agent conversations. Messages expose `segmentId` with `messageNo`; both are required when selecting a learning source. API credentials remain on the backend.

## Routes

- `/conversation` restores the most recently selected saved Agent, or the creation editor for a new user.
- `/conversation/agents/{agentId}` opens that Agent's last meaningful conversation.
- `/conversation/agents/{agentId}?new={requestId}` opens a new conversation draft without creating a database record.
- `/conversation/threads/{threadId}` restores a durable logical conversation.
- `/conversation/{sessionId}` remains compatible with earlier links and learning-material sources.

## Save and restart behavior

Final voice transcripts show a saving state until acknowledged. Failed transcripts remain visible and in tab-scoped recovery storage, with a Retry save action. Leaving with unacknowledged transcripts is blocked until recovery. Server-side event IDs prevent retry duplicates.

Agent voice reservations are persisted separately. On backend startup, orphaned reservations are settled to their latest confirmed activity and their segments marked interrupted; transcripts remain readable. Completed sessions are not refunded twice. This recovery assumes the current single-backend deployment.

## Validation

Run frontend `npm test`, `npm run build` and `npm run test:checks`. Run backend `./mvnw test` for the regular suite. `AgentThreadsIT` runs the shared `AgentThreadsContract` against a fresh PostgreSQL 17 container during `./mvnw -B -Pci-integration verify`. The same contract additionally runs as `AgentThreadsLocalTest` with `LOCAL_AGENT_DB_TESTS=true` against a dedicated PostgreSQL database `agent_chat_test` at `127.0.0.1:55432`, user `postgres`. It uses mocked AI and lifecycle creation and never calls a real provider.

Acceptance checks include preserving existing messages and learning sources, default restoration instead of newer empty sessions, direct session-link compatibility, drawer opening / closing, history filtering, stable old snapshots after edits, idempotent messages, active-voice protection and restart quota recovery.


## 历史记录删除与恢复

历史记录每行提供删除按钮；确认后移入回收站，正常历史列表、Agent 默认打开结果和旧版会话列表都会排除它。回收站支持当前 Agent / 全部 Agent 筛选及恢复；恢复保留原来的消息、设置快照和词句来源。此功能不执行永久删除，也不会删除 Agent、收藏词句、练习记录或累计练习统计。

删除当前聊天会退出该聊天，打开同一 Agent 其余最近的有效聊天；没有历史则显示空聊天，不额外创建记录。正在语音通话或存在未保存消息时禁止删除当前记录。后端按登录用户验证删除和恢复权限，锁定会话与写消息串行；删除后不能通过旧接口继续发消息或接入语音。旧版无 Agent 关联记录使用独立回收站标记，仍可恢复。

数据库迁移 V16 只增加软删除标记及索引，不修改原始消息或历史迁移。相关集成测试仅操作独立的 `agent_chat_test` 数据库并在结束时回滚，不调用真实 AI。

学习资产的词句、对话记录和练习记录独立加载。单个请求失败只在对应分类提示错误，并可单独重试；失败不会显示成空收藏，也不会清空其他分类。练习记录查询按登录用户筛选，不引用训练记录不存在的 `thread_id`；来源对话移入回收站后，已完成的练习仍保留。

## 2026-10-20 自由对话界面

仅自由对话使用合并侧栏；其他模块仍使用原 AppShell 导航。已保存伙伴直接进入聊天，设置在“更多操作 → 修改设置”的抽屉中编辑，完整提示词位于高级设置；所有音色、等级和语速保留。

语音和文字有独立入口。通话中切换文字或离开页面，先确认结束并等待最后转写保存，再进入同一逻辑对话的文字输入。取消保持通话；保存失败时保留消息并阻止切换，可重试保存。未发文字草稿仍按用户和 thread 隔离。

随手记按需展开，沿用真实收藏和来源 ID。消息翻译与朗读按需请求并在组件内缓存，朗读在进入语音、切换聊天或卸载时停止；接话提示仅带入输入框，不自动发送，聊天变化时失效。打开历史、设置或聊天不调用新 AI 接口。

侧栏历史默认查看全部 Agent，聊天标题旁历史默认当前 Agent；服务端按伙伴名、目的与消息搜索，再进行 50 条分页。话题标题来自首条真实用户消息，空会话默认收起，可展开；回收站与恢复沿用现有保护。

本地验收不主动开启真实麦克风或发送付费模型请求。语音切换、失败补存和消息辅助使用模拟客户端/模型验证，持久化测试使用独立回滚数据库。

### 界面文案精简

移除语音待连接卡片的口号、重复保存说明及英文装饰标题；语音操作区仅保留音色、语速和开始/继续按钮。输入框使用“输入消息…”，设置与预览删除重复解释，随手记仅在空状态提示收藏操作。保留实际连接/静音状态、保存失败重试、旧记录兼容提示及切换/删除确认。此轮仅调整前端文案与排版，后端及聊天持久化流程不变。

### 底部操作栏对齐

模式切换、声音信息、接话建议和语音启动合并在同一操作栏，宽度与聊天内容一致（最大 680px）。宽屏左右分组并垂直居中；根据聊天区域实际宽度使用容器查询，在窄屏排列为对齐的两行。文字输入与活动语音控制在操作栏下展开，保留原有发送、停止和保存确认逻辑。

底部音色与语速信息现在是可点击的设置入口，显示下拉箭头和悬停/键盘焦点状态。点击打开原设置抽屉并聚焦音色选择，关闭后焦点返回入口；保存仍仅影响下一段新对话，旧聊天快照保持原设置。


## CI regression coverage

PostgreSQL persistence tests truncate the complete related table set, including chat threads, voice transcripts and leases. Fresh-schema and legacy-schema assertions cover migrations V1–V17 (plus baseline V0 for legacy data). Practice history joins the learning item to recover its source session; training attempts do not have a `thread_id` column. Saved practice records remain visible after the source conversation moves to trash.

The regular unit suite does not require Docker. The `ci-integration` profile additionally runs `AgentWorkspaceIT`, `AgentThreadsIT`, `PostgresPersistenceIT` and the Redis container tests. The thread contract covers latest-chat restoration, immutable snapshots, owner isolation, voice/text continuation, retry idempotency, trash/restore, practice sources, preset registration and history search. No workflow gate is disabled or weakened.

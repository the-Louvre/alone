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

Run frontend `npm test`, `npm run build` and `npm run test:checks`. Run backend `./mvnw test` for the regular suite. `AgentThreadsLocalTest` additionally runs with `LOCAL_AGENT_DB_TESTS=true` against a dedicated PostgreSQL database `agent_chat_test` at `127.0.0.1:55432`, user `postgres`. It uses mocked AI and lifecycle creation and never calls a real provider.

Local acceptance checks include preserving Tony's original seven message hashes, default restoration instead of the two newer empty sessions, direct session-link compatibility, drawer opening / closing, history filtering, stable old snapshots after edits, idempotent messages, active-voice protection and restart quota recovery.


## 历史记录删除与恢复

历史记录每行提供删除按钮；确认后移入回收站，正常历史列表、Agent 默认打开结果和旧版会话列表都会排除它。回收站支持当前 Agent / 全部 Agent 筛选及恢复；恢复保留原来的消息、设置快照和词句来源。此功能不执行永久删除，也不会删除 Agent、收藏词句、练习记录或累计练习统计。

删除当前聊天会退出该聊天，打开同一 Agent 其余最近的有效聊天；没有历史则显示空聊天，不额外创建记录。正在语音通话或存在未保存消息时禁止删除当前记录。后端按登录用户验证删除和恢复权限，锁定会话与写消息串行；删除后不能通过旧接口继续发消息或接入语音。旧版无 Agent 关联记录使用独立回收站标记，仍可恢复。

数据库迁移 V16 只增加软删除标记及索引，不修改原始消息或历史迁移。相关集成测试仅操作独立的 `agent_chat_test` 数据库并在结束时回滚，不调用真实 AI。

-- Recoverable history removal; keep messages, settings and learning sources intact.
ALTER TABLE agent_chat_thread ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_agent_thread_visible ON agent_chat_thread(user_id, agent_id) WHERE deleted_at IS NULL;
CREATE TABLE agent_legacy_history_trash (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES practice_session(session_id),
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

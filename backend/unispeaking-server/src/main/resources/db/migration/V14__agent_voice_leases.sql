CREATE TABLE agent_voice_lease (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES agent_conversation(session_id),
    user_id UUID NOT NULL REFERENCES users(id),
    quota_date DATE NOT NULL,
    reserved_seconds DOUBLE PRECISION NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL
);

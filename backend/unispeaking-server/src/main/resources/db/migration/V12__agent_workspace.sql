CREATE TABLE conversation_agent (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    config TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversation_agent_owner ON conversation_agent(user_id, updated_at DESC);

-- The settings used for a conversation are immutable, even when its Agent changes.
CREATE TABLE agent_conversation (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES practice_session(session_id),
    user_id UUID NOT NULL REFERENCES users(id),
    config TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    channel VARCHAR(8) NOT NULL CHECK (channel IN ('text','voice')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX agent_conversation_owner ON agent_conversation(user_id, created_at DESC);
CREATE TABLE agent_text_turn (
    session_id VARCHAR(64) NOT NULL REFERENCES agent_conversation(session_id),
    request_id UUID NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY(session_id, request_id)
);
CREATE TABLE agent_learning_item (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    session_id VARCHAR(64) NOT NULL REFERENCES agent_conversation(session_id),
    message_no INTEGER NOT NULL,
    kind VARCHAR(8) NOT NULL CHECK (kind IN ('word','sentence')),
    text TEXT NOT NULL,
    meaning TEXT NOT NULL DEFAULT '',
    source_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, session_id, message_no, kind, text),
    FOREIGN KEY(session_id, message_no) REFERENCES session_message(session_id, message_no)
);
CREATE INDEX agent_learning_item_owner ON agent_learning_item(user_id, created_at DESC);
CREATE TABLE agent_training_attempt (
    id UUID PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES agent_learning_item(id),
    user_id UUID NOT NULL REFERENCES users(id),
    answer TEXT NOT NULL,
    feedback TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX agent_training_attempt_owner ON agent_training_attempt(user_id, created_at DESC);

CREATE TABLE agent_chat_thread (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    agent_id UUID REFERENCES conversation_agent(id),
    config TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, request_id)
);
ALTER TABLE agent_conversation ADD COLUMN thread_id UUID REFERENCES agent_chat_thread(id);

-- Keep every original message, setting snapshot, session ID and learning source.
INSERT INTO agent_chat_thread(id,user_id,agent_id,config,system_prompt,created_at)
SELECT md5(a.session_id)::uuid, a.user_id, c.id, a.config, a.system_prompt, a.created_at
FROM agent_conversation a
LEFT JOIN conversation_agent c ON c.id::text=a.config::jsonb->>'id' AND c.user_id=a.user_id;
UPDATE agent_conversation SET thread_id=md5(session_id)::uuid;
ALTER TABLE agent_conversation ALTER COLUMN thread_id SET NOT NULL;
CREATE INDEX agent_chat_thread_owner ON agent_chat_thread(user_id,agent_id,created_at DESC);
CREATE INDEX agent_conversation_thread ON agent_conversation(thread_id,created_at,session_id);
ALTER TABLE conversation_agent ADD COLUMN last_thread_id UUID REFERENCES agent_chat_thread(id);
ALTER TABLE conversation_agent ADD COLUMN last_opened_at TIMESTAMPTZ;

CREATE TABLE agent_voice_message (
    session_id VARCHAR(64) NOT NULL REFERENCES agent_conversation(session_id),
    event_id VARCHAR(200) NOT NULL,
    message_no INTEGER NOT NULL,
    PRIMARY KEY(session_id,event_id),
    FOREIGN KEY(session_id,message_no) REFERENCES session_message(session_id,message_no)
);

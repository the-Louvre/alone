-- Timestamps may be equal inside one transaction; a sequence preserves segment order.
ALTER TABLE agent_conversation ADD COLUMN segment_order BIGINT GENERATED ALWAYS AS IDENTITY;
CREATE INDEX agent_conversation_thread_order ON agent_conversation(thread_id,segment_order);

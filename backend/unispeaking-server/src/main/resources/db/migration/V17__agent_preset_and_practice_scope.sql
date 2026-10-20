-- Preserve existing agents, conversations, source messages and learning records.
ALTER TABLE conversation_agent ADD COLUMN preset_key VARCHAR(32);
ALTER TABLE conversation_agent ADD COLUMN preset_request_id UUID;
CREATE UNIQUE INDEX conversation_agent_preset_owner ON conversation_agent(user_id,preset_key) WHERE preset_key IS NOT NULL;
CREATE UNIQUE INDEX conversation_agent_preset_request ON conversation_agent(user_id,preset_request_id) WHERE preset_request_id IS NOT NULL;
COMMENT ON COLUMN conversation_agent.preset_key IS 'Stable source of an automatically saved preset; explicit copies have no source key';
ALTER TABLE agent_learning_item ADD COLUMN selection_scope VARCHAR(12) CHECK(selection_scope IN ('word','sentence','passage'));
COMMENT ON COLUMN agent_learning_item.selection_scope IS 'Selection unit for new collections; NULL preserves legacy classification';
ALTER TABLE agent_training_attempt ADD COLUMN target_text TEXT;
COMMENT ON COLUMN agent_training_attempt.target_text IS 'Exact selected expression from the original collection; NULL uses the original legacy text';

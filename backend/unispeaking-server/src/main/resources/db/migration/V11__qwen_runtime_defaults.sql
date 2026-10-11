-- Qwen is the only generative/audio runtime route. iFlytek Suntone remains
-- enabled exclusively for pronunciation scoring because it provides the
-- phoneme-level assessment contract used by the language evaluation flow.

UPDATE ai_providers
SET enabled = CASE
        WHEN provider_id IN ('qwen', 'iflytek') THEN TRUE
        ELSE FALSE
    END,
    updated_at = CURRENT_TIMESTAMP;

-- Clear existing priorities first so the unique (capability, route_priority)
-- constraint cannot collide while the canonical routes are promoted.
UPDATE ai_models
SET enabled = CASE
        WHEN provider_id IN ('qwen', 'iflytek') THEN TRUE
        ELSE FALSE
    END,
    route_priority = NULL,
    updated_at = CURRENT_TIMESTAMP;

UPDATE ai_models
SET route_priority = 10,
    updated_at = CURRENT_TIMESTAMP
WHERE model_id IN (
    'qwen3.5-omni-flash-realtime',
    'qwen3.5-plus',
    'qwen3-asr-flash',
    'qwen3-tts-flash',
    'iflytek-suntone'
)
AND provider_id IN ('qwen', 'iflytek');


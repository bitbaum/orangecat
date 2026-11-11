-- A provider failure is a failed turn, not a completed assistant answer.
ALTER TABLE public.cat_messages ADD COLUMN failure jsonb;
ALTER TABLE public.cat_messages ADD CONSTRAINT cat_message_failure_shape CHECK (
  failure IS NULL OR (
    role = 'assistant' AND jsonb_typeof(failure) = 'object'
    AND failure ? 'kind' AND failure ? 'message'
    AND jsonb_typeof(failure -> 'kind') = 'string'
    AND jsonb_typeof(failure -> 'message') = 'string'
  )
);

-- Only exact historical application errors and the application's truncation
-- suffix are recognized. Do not guess from ordinary assistant prose.
UPDATE public.cat_messages
SET failure = jsonb_build_object(
  'kind', CASE WHEN content LIKE 'Free AI capacity is maxed out%' THEN 'AI_RATE_LIMITED' ELSE 'STREAM_ERROR' END,
  'message', content
)
WHERE role = 'assistant' AND (
  content IN (
    'Free AI capacity is maxed out right now. Try again in a minute — or add your own free Groq key in Settings → AI for capacity that’s all yours.',
    'Cat couldn’t reach an AI model just now — this is usually momentary. Try again; if it keeps happening, add your own free Groq key in Settings → AI.',
    'Cat couldn’t generate a response. Try again, or add your own key in Settings → AI.',
    'The shared AI provider is rate-limiting requests. Try again later, or add your own provider key in Settings → AI.'
  ) OR right(content, length('[This reply was cut off by a connection error.]')) = '[This reply was cut off by a connection error.]'
);

# A feeling can become many works

The Studio starts with a memory, mood or scene. A medium is an interpretation
of that brief, rather than a new brief. The first shipped slice lives at
`/studio`; form definitions and request/output limits live in
`src/domain/creative/brief.ts`, and its model prompt lives beside them.

A musical draft has an original bounded symbolic score. The browser renders
it to a short PCM WAV with explicit playback and a download. It is an
instrumental sketch with limited synthesized timbres, not a vocal recording or
a mastered production in any requested genre. The morning example is a
composed fixture, labelled separately from AI drafts. Writing produces text;
fiction produces an opening scene, film a treatment. Artwork first produces a
prompt; a separate explicit action uses the existing BYOK image generator.
Nothing is published, commissioned or paid automatically. Drafts live in the
tab and can be exported with their brief and score. AI creation uses the
existing authenticated, rate-limited platform model chain.

## Next production seams

- Keep one creative work identity across brief, human edits, versions and
  artifacts. Store authorship/contributor and parent-version metadata, not
  just a generated file URL. Human-only, AI-only and collaborative work all fit.
- Use chatkit’s shared audio block for durable tool-returned tracks, with explicit
  playback, creator and caption. Add video and richer provenance next. The
  assistant may only attach actual tool-returned media URLs.
- Add music-provider adapters to the shared AI engine with capability discovery
  (instrumental, vocals, duration, stems, reference input), explicit quotes,
  cancellable/idempotent jobs and durable artifact storage. Use documented
  provider APIs, not unofficial wrappers. An unavailable backend must never
  masquerade as a generated song.
- Put listening and creating beside each other: playable authorized previews
  and links to existing songs, original drafts, then variation and sequencing
  for a mood-driven DJ. A provider/catalogue integration must carry attribution
  and usage rights. A link to a song is not a licence to redistribute its audio.
- Keep the same brief when moving from song to poem, illustration, film,
  animation or performance. Each medium needs its own production adapter and
  quality check. A film treatment is not a rendered film.
- Commissioning a painter, musician or physical robot is an execution workflow:
  a person reviews the brief, price, rights, delivery and recipient before
  booking. Cat supplies public offers/funding; Loki coordinates approved work.
  Do not send private memories to collaborators merely because a brief exists.

This is the first implementation of the mood-driven DJ/creative workspace
found in the connected repositories. Searches found event-DJ roles and Loki's
ambient soundscape, but no earlier implementation of this particular concept.
It does not establish that the idea never existed in a separate conversation.

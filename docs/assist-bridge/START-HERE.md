# START-HERE — VCFO Suite

Unzip this pack into the repo. If `docs/` already holds another context pack, put
this one in `docs/assist-bridge/` and adjust the prompt paths below.

Open Claude Code at the repo root and paste:

```
Read CLAUDE.md in this pack, then every file in its docs/ folder in numerical
order. Ignore every other context or briefing document in this repository —
they belong to unrelated work.

Build phases P1, P2 and P3 from docs/04-phases.md in this session. Do not stop
to ask me anything.

Rules that matter most:
- Reuse the existing doc-pack resolvers. Never read checklist_state directly.
- The mapping module is pure: no db, no S3, no React, no fetch.
- Unit tests are required, following the pattern beside src/lib/doc-pack/*.test.ts.
- Verify with `npm run typecheck && npm run test` after every phase.
- No new tables, no migration, no checklist/gate/email/board-resolution changes.
- Every value that must match MCA dropdown text exactly goes in vocabulary.ts.
- A field Suite doesn't hold is omitted and listed in `missing` — never a placeholder.

Append to TASKS.md after each phase. Judgement calls go to QUESTIONS.md with the
default you chose; keep going.
```

## When it finishes

Answer anything in `QUESTIONS.md`, then run `docs/05-acceptance.md`.

P3 ends with a working clipboard path: open Pre-4, click Copy for Assist, paste into
the extension, fill a form. That proves the mapping before the extension work starts.

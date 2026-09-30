# Design decisions

Running log of choices made where the brief left room. Newest at the bottom of each section.

## Process
- **D-001 Branching.** Work is on `feature/core-mvp` (from up-to-date `main`), committed per phase, **not pushed** (per brief).
- **D-002 Baseline fixes.** `Milestones.jsx` had a JS syntax error breaking `npm run build`; `backend/package-lock.json` was out of sync with `package.json`. Both fixed before Phase 1.

## Ports / config
- **D-003 Frontend port = 3000.** `.env.example` said 3000, `server.js` and `vite.config.js` said 3001. 3000 chosen (matches the documented example); all three now agree.

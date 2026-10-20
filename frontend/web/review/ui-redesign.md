# Web UI redesign review

Issue: https://github.com/the-Louvre/alone/issues/5

This is a reviewable first implementation in the existing React/Vite app, not a static prototype. It keeps the existing routes, API contracts, authentication, Agent workspace behavior, and realtime session code. Backend, database, and business rules are unchanged.

## What changed

- Public landing: new wordmark, concise hero, three-step interactive product preview, practice-mode entry points, voice preview, pricing, and FAQ. The hero has no teacher portrait.
- Shared visual direction: near-white surfaces, cool blue accents, consistent typography and focus states across landing, login, sidebar, Agent workspace, scene training/result, and IELTS representative views.
- Product preview text distinguishes recognized subtitles from later expression advice. Its "interface demo" label is intentional; it is not a live session or a promise of audio replay or memory confirmation.
- Existing page callbacks still route into the app. IELTS and interview retain their separate flows.

## Review screenshots

All screenshots are from the running React app at a 1440 x 900 desktop viewport. Authenticated screenshots used isolated browser-only fixture responses for visual review; they do not prove backend integration or a real score.

| View | Screenshot |
| --- | --- |
| Landing | [landing.png](screenshots/landing.png) |
| Login | [login.png](screenshots/login.png) |
| Agent workspace | [agent-workspace.png](screenshots/agent-workspace.png) |
| Scene training | [training.png](screenshots/training.png) |
| Result when evaluation is pending | [result-pending.png](screenshots/result-pending.png) |
| IELTS intake | [ielts-intake.png](screenshots/ielts-intake.png) |

## Run and verification

From `frontend/web`, run `npm install` if needed, then `npm run dev`; open `http://127.0.0.1:5173/`. Authenticated routes need the existing backend and a valid account.

- `npm run build`: passed. Vite still warns about a chunk over 500 kB.
- Landing component tests: 3 passed.
- Route contract: 77 assertions passed. Realtime event checks passed.
- Full Vitest run: 209 passed, 2 existing API-client Blob/Response assertions failed in `apiClient.test.js` (`[object Blob]` instead of `audio`). No API-client source or test file was changed here.
- `npm run test:checks`: passes routes, realtime, auth, analytics, telemetry, assets, pronunciation, and call timer; stops at the unchanged `check:profile-overview` source-pattern assertion.

## Not in this review

This is the representative-page pass requested for renewed review, not a claim that all pages or all 85 states have been redesigned. Real speech, agent creation, IELTS scoring, and backend integration were not exercised by the screenshot fixtures. Further page-by-page expansion and live-flow acceptance remain open.

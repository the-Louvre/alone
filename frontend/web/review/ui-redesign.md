# Web UI redesign review

Issue: https://github.com/the-Louvre/alone/issues/5

This is a reviewable implementation in the existing React/Vite app, not a static prototype. It keeps the existing API contracts, authentication, Agent workspace, and realtime session code. Backend, database, and business rules are unchanged. The branch is for review; Issue #5 remains open and this PR is not an approval or merge request.

## What changed

- Public landing (`LandingPage.jsx`, `landing.css`): new wordmark, concise hero, Agent-workspace-inspired preview, three-step product demonstrations, practice-mode entry points, FAQ, and `/pricing`. No teacher portrait is shown in the hero.
- Shared UI (`common/styles.css`, `agentWorkspace.css`): near-white surfaces, restrained accents, spacing, controls, and states across the login, navigation, Agent workspace, scene training/result, IELTS, assets, and profile representative views.
- Components and assets: Agent select controls and menu, score animation, editorial teacher/examiner portraits, and empty-state return paths. Existing callbacks still route into the app; IELTS and interview retain separate flows.
- The landing demonstrations distinguish ASR transcription from extracted phrases and advice. They are illustrations, not a live session or a claim that candidate-memory confirmation exists.

## Review screenshots

Current public screenshots are from the running React app at 1440 x 900 with reduced motion enabled to capture a settled frame. The authenticated screenshots below were captured earlier on this branch using isolated browser-only fixture responses. Some visual details have since changed; use the current code for those pages. Neither screenshot set proves backend integration, a real score, or a working realtime microphone session.

| View | Screenshot |
| --- | --- |
| Current landing | [landing.png](screenshots/landing.png) |
| Current three-step section | [landing-journey.png](screenshots/landing-journey.png) |
| Earlier login fixture | [login.png](screenshots/login.png) |
| Earlier Agent workspace fixture | [agent-workspace.png](screenshots/agent-workspace.png) |
| Earlier scene training fixture | [training.png](screenshots/training.png) |
| Earlier pending-result fixture | [result-pending.png](screenshots/result-pending.png) |
| Earlier IELTS intake fixture | [ielts-intake.png](screenshots/ielts-intake.png) |

## Run and verification

From `frontend/web`, run `npm install` if needed, then `npm run dev`; open `http://127.0.0.1:5173/`. Authenticated routes need the existing backend and a valid account.

- `npm run build`: passed. Vite still warns about a chunk over 500 kB.
- `npm test`: 218 passed, 2 failed in unchanged `apiClient.test.js`; the test runtime reads `[object Blob]` where the assertions expect `audio`.
- `npm run test:checks`: passes routes (77 assertions), realtime events, auth, analytics, telemetry, assets, pronunciation, and call timer; stops at `check:profile-overview`. That script requires LF in a source-text regex while the Windows checkout uses CRLF. Later checks in this chained command did not run.
- Live authenticated API and microphone end-to-end verification: not run for this review. No backend or credential changes were made.

## Not in this review

This is the representative-page pass requested for renewed review, not a claim that all pages or all 85 states have been redesigned. Agent deletion remains unavailable without server support; the Agent menu labels this explicitly. Candidate-memory confirmation is not wired into the current product, and the landing demonstrations do not replace it. Pricing copy is illustrative and must be confirmed before release. Real speech, agent creation, IELTS scoring, and backend integration were not exercised by screenshot fixtures. Further page-by-page expansion and live-flow acceptance remain open.

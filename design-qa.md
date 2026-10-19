# Free conversation window design QA

final result: passed

## Scope and visual truth

Source: `design/agent-home-2026-10-19/purpose-chat/01-purpose-to-prompt.png` (the user-approved local reference, 1489 × 1056). The later user instructions override its standalone shell: keep the original application navigation, scene plaza and profile; open free conversation in the existing right content area; keep Agent selection inside that window, with no interview entry or top Agent toolbar.

Implementation: `design/agent-home-2026-10-19/implementation/integrated-conversation.png`, captured from the running application at `/conversation`. The unchanged scene plaza is captured in `original-scenes.png`; the local history drawer in `integrated-history.png`.

Desktop CSS viewport and captured pixels: 1489 × 1056, density 1. Mobile: 390 × 844 CSS pixels and captured pixels, density 1. No density rescaling. An isolated iframe provided the viewport without changing the user's browser window; that test harness is excluded from the change.

State: travel template, editable example prompt, B1, Clara, corrections after conversation. The reference shows a generated opening; the implementation screenshot intentionally shows the pre-generation empty state. Real generation and the subsequent chat were tested separately. No fabricated preview messages are rendered.

## Findings and iteration history

- Resolved P1: switching to free conversation replaced/expanded the shared navigation. Restored the original AppShell exactly; the Agent list now belongs to the right content window. AppShell, Scenes and Profile in the submitted change are identical to the base branch. Regression tests assert the same outer sidebar DOM across conversation, scenes, assets and profile.
- Resolved P1: opening scene inspiration and history navigated away from the editor. Inspiration now expands below the purpose input; history and vocabulary open inside the same right window. Agent switches do not navigate when already editing. Tests check that drafts and the active composer survive panel opening/closing and that no navigation callback fires.
- Resolved P2: narrow history rows exceeded the drawer width. Applied a minmax(0,1fr) grid and constrained buttons. Post-fix evidence: `history-mobile.png`, with the whole item, arrow and close button visible.
- No remaining actionable P0/P1/P2 visual finding in the tested states.

## Comparison evidence

The source and desktop implementation were opened together in the same comparison input. Text, field boundaries and setting controls were readable at their native dimensions; a further focused crop was unnecessary. The mobile editor and history drawer were inspected separately as responsive states; the source does not specify a mobile composition.

- Typography: system Chinese fallback with clear title, label and body hierarchy. Prompt text remains editable, with comfortable line height. Auxiliary labels are more compact than the mock (P3).
- Layout: purpose → editable prompt → voice/correction/level → start actions preserved. Original 92px global nav stays outside the feature; the in-window Agent list is 220px on desktop and an accessible named icon rail on mobile. Right preview and editor stack when their container narrows.
- Colors: warm white, pale green selection, charcoal primary controls, restrained borders. Matches the original free-chat palette and requested minimal style.
- Images/icons: original project brand retained; project Phosphor icons used for interface controls. No new teacher portrait or generic stock avatar introduced.
- Copy: no assessments, scores, upload requirement or interview workflow in ordinary free chat. Agent roles/styles/topics are expressed in editable natural-language prompts.
- Motion: hover/press transitions, generating shimmer, loading indicator, speech wave and local panel entrance; reduced-motion override included. No full-shell transition added.

## Interaction and validation evidence

- Browser: Agent switching, local scene suggestions, local history opening/closing, original scene plaza navigation; zero errors in the isolated browser console during final checks.
- Automated Web: 210 tests passed, all contract checks passed, production build passed in the PR checkout.
- Backend: 1486 unit tests and 13 PostgreSQL/Redis integration tests passed. Integration tests include ownership, immutable snapshots, retry idempotency and source-linked training.
- Real local provider: purpose generation, edited-prompt text conversation, extraction, collection, practice feedback and completed history verified against the configured provider and PostgreSQL.
- The existing completion callback still refreshes profile progress and achievement state; completion stays in the same chat window.
- Actual microphone/provider audio exchange remains a manual test gap. Voice startup configuration, transcript updates and error handling are covered with mocks; no full microphone verification is claimed.

## Implementation checklist

- [x] Original outer shell, scene plaza and profile retained.
- [x] Multiple Agents and new-Agent action inside the conversation window.
- [x] Local scene inspiration, words, sentences and history.
- [x] Editable generated prompt used for real chat.
- [x] Desktop and narrow layout inspected after fixes.
- [x] Scoped tests, build and integration checks passed.
- [ ] Optional P3: increase auxiliary label sizes after visual review at the user's preferred zoom.

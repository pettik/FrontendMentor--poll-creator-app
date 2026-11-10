# Validation record

Tested on 10 November 2026 with Node.js 20.19.3 and installed Google Chrome, through Playwright in isolated browser contexts. Browser tests use the production build on a loopback-only server from this repository.

## Recorded results

| Check | Result |
| --- | --- |
| Product rules, workspace validation, and local tooling (`npm test`) | 21 tests passed |
| Production browser journeys (`npm run test:e2e`) | 16 tests passed |
| axe checks on tested screens and dialogs | No WCAG A/AA violations reported |
| 320px and 375px layouts | No horizontal overflow in tested states |
| 320px with 200% root text | No horizontal overflow on the ballot |
| Keyboard | Choice selection, vote confirmation, Escape, and focus return passed |
| Final PNG | Downloaded and visually inspected, including a tied result |
| Avatar generation | Local Micah SVGs in the page and exported PNG |
| Damaged storage and quota failures | No silent overwrite or duplicate vote; expired ballots still close |
| Cross-tab updates | Focused choice, name, selection, and unfinished creation draft preserved |
| Loaded app offline | Complete create-and-vote journey passed; no external HTTP requests |
| Local release (`npm run release:prepare`) | Syntax checks, 37 tests, production build, and ZIP completed |
| Distribution archive | 16 files match `dist/`; Python zipfile CRC validation and SHA-256 check passed |

### Product rules

The unit suite exercises option-count and duplicate-label validation, future deadlines, multi-choice bounds, idempotent retries, final votes, rejection after closing, pending-suggestion isolation, zero-vote approval, moderation transitions, decline Undo, the ten-option cap, reopening with retained votes, attribution only after settling, and preservation of the five-poll/32-vote sample dataset. Additional tests validate nested stored records, reject duplicate/foreign votes, check the ZIP structure and byte preservation, and verify local HTTP responses for missing assets and unsupported methods.

### Browser journeys

1. Landing → guest dashboard → live results → settled result, with axe checks and screenshots.
2. A 375px voter chooses a face and tint, suggests an option, confirms a vote, refreshes, passes to another voter, produces a tie, reveals it, and downloads the PNG.
3. Host declines and undoes a suggestion, approves it with zero votes, ends voting, and reopens with all 11 original votes retained. Focus is checked after moderation.
4. An empty workspace validates the form, creates a multi-choice poll, rejects a third pick beyond a limit of two, and preserves the final vote after refresh.
5. A 320px ballot reflows at 200% text; missing polls have an explanatory state; expired polls show results rather than a ballot.
6. Keyboard-only selection and vote confirmation work; Escape closes the suggestion dialog and restores the trigger's focus.
7. A quota failure during the final vote keeps the confirmation available; retrying after recovery adds exactly one vote, including after refresh.
8. An elapsed deadline removes the ballot even when storage writes fail; closing is persisted once writing recovers.
9. Damaged nested data shows a recovery notice, remains untouched on cancellation, and is removed only by confirmed reset.
10. Creation validation focuses the actual empty option; removing the first option retains focus on a surviving input.
11. Another tab's moderation updates keep the same ballot choice focused and preserve the name, picks, and unfinished creation draft.
12. Copy local link and Copy result produce different payloads; deleting a poll can be canceled or confirmed.
13. A 23-person poll displays exact counts without individual ticks; a failed avatar image leaves its background tint visible.
14. Unbroken 140-character titles and 100-character option names reflow at 320px; a zero-vote closed poll exports a PNG.
15. Once loaded, the app creates a poll and records a vote offline without external requests.
16. The production vote page passes the local mobile loading budget and an axe check.

## Local performance snapshot

Chrome at 375 × 812, with CPU throttled 4×, download throughput of 200 KiB/s, and 150ms network latency:

| Measurement | Recorded result |
| --- | --- |
| First contentful paint | 784ms |
| Visible, interactive ballot | 1,815ms |
| Resource transfer at readiness | 205,441 bytes |

These are synthetic local browser measurements, not Lighthouse scores or results from a physical phone. The test records its current measurements in `test-results/local-performance.json` and checks that the ballot is ready within three seconds.

## Fixes found during validation

- Avatar/identity controls and ballot labels needed additional wrapping at 320px with 200% text.
- Fontsource's variable font family names differ from the plain font names; both UI typography and Canvas now use the actual locally bundled families.
- The offscreen skip link is also clipped until focused, keeping it out of full-page screenshots.
- The last suggestion's removal moves focus to the poll heading when no moderation heading remains.
- Deadline checks preserve an unrelated, unfinished creation form.
- Stored workspaces now validate nested options, votes, identity, and turn records before rendering; invalid data is not automatically replaced.
- Storage failure no longer keeps a timed-out ballot visibly open, and a failed cast can be retried without duplicate counting.
- Browser-tab updates restore the specific active control; live race summaries are throttled.
- The local preview now returns proper 404 responses for missing assets and includes all runtime license notices in the distribution.

## Limits of this record

- No manual NVDA, VoiceOver, or TalkBack session was performed. Automated axe checks and keyboard tests are not full WCAG certification.
- Lighthouse was not run because installation of that optional audit tool was declined. No Performance, Best Practices, or SEO score is claimed.
- Tests used Chrome on Windows, including mobile-sized viewports. A physical phone, Safari, and Firefox were not tested.
- Screenshots and browser interaction were verified through the project's headless browser test harness.
- This frontend-only product intentionally has no server-side integrity, accounts, or remote multi-device voting.
- Public deployment is intentionally excluded from this delivery. No build, test, preview, or packaging script uploads files, contacts Sites, or creates remote infrastructure. An eventual public submission would still require a public URL and an incognito/physical-phone check on that origin.

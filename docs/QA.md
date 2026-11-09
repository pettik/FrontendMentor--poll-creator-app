# Validation record

Tested on 9 November 2026 with Node.js 20.19.3 and installed Google Chrome, through Playwright in isolated browser contexts.

## Recorded results

| Check | Result |
| --- | --- |
| Product rules (`npm test`) | 15 tests passed |
| Browser journeys (`npm run test:e2e`) | 6 tests passed |
| axe checks on tested screens and dialogs | No WCAG A/AA violations reported |
| 320px and 375px layouts | No horizontal overflow in tested states |
| 320px with 200% root text | No horizontal overflow on the ballot |
| Keyboard | Choice selection, vote confirmation, Escape, and focus return passed |
| Final PNG | Downloaded and visually inspected, including a tied result |
| Avatar generation | Local Micah SVGs in the page and exported PNG |

### Product rules

The unit suite exercises option-count and duplicate-label validation, future deadlines, multi-choice bounds, idempotent retries, final votes, rejection after closing, pending-suggestion isolation, zero-vote approval, moderation transitions, decline Undo, the ten-option cap, reopening with retained votes, attribution only after settling, and preservation of the five-poll/32-vote sample dataset.

### Browser journeys

1. Landing → guest dashboard → live results → settled result, with axe checks and screenshots.
2. A 375px voter chooses a face and tint, suggests an option, confirms a vote, refreshes, passes to another voter, produces a tie, reveals it, and downloads the PNG.
3. Host declines and undoes a suggestion, approves it with zero votes, ends voting, and reopens with all 11 original votes retained. Focus is checked after moderation.
4. An empty workspace validates the form, creates a multi-choice poll, rejects a third pick beyond a limit of two, and preserves the final vote after refresh.
5. A 320px ballot reflows at 200% text; missing polls have an explanatory state; expired polls show results rather than a ballot.
6. Keyboard-only selection and vote confirmation work; Escape closes the suggestion dialog and restores the trigger's focus.

## Fixes found during validation

- Avatar/identity controls and ballot labels needed additional wrapping at 320px with 200% text.
- Fontsource's variable font family names differ from the plain font names; both UI typography and Canvas now use the actual locally bundled families.
- The offscreen skip link is also clipped until focused, keeping it out of full-page screenshots.
- The last suggestion's removal moves focus to the poll heading when no moderation heading remains.
- Deadline checks preserve an unrelated, unfinished creation form.

## Limits of this record

- No manual NVDA, VoiceOver, or TalkBack session was performed. Automated axe checks and keyboard tests are not full WCAG certification.
- Lighthouse was not run because installation of that optional audit tool was declined. No Performance, Best Practices, or SEO score is claimed.
- Tests used Chrome on Windows, including mobile-sized viewports. A physical phone, Safari, and Firefox were not tested.
- Browser/computer-control tools could not initialize in this environment. Screenshots and browser interaction were verified through the project's headless browser test harness.
- This frontend-only product intentionally has no server-side integrity, accounts, or remote multi-device voting.
- Final production build and JavaScript syntax checks passed. A Sites project was registered and a separate local source checkout prepared, but the source-upload action was declined. Public deployment and an incognito check of a deployed origin remain outstanding.

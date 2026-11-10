# Frontend-only acceptance checklist

This delivery follows the developer's confirmed **single-device, pass-the-phone** path. It keeps the complete decision lifecycle and replaces remote accounts/sharing with a trusted device and physical handoff. No animation or templates are included.

| Requirement | Delivered behavior | Evidence |
| --- | --- | --- |
| Landing and guest mode | Product explanation, empty workspace, five realistic demo polls with shifted dates | Browser landing/guest journey; sample-data unit test |
| Creator accounts | Replaced by ownership of this browser, as allowed by the frontend-only path | Workspace settings and explicit on-device copy |
| Dashboard | Earliest deadline featured; open and settled sections; pending suggestion counts | Guest dashboard and moderation journeys |
| Poll creation | Title, 2–10 distinct options, future deadline, one or several picks, suggestion toggle | Validation unit tests and first-run journey |
| Share step | Clear instructions to pass this device; local links explicitly labeled | Creation and copy-payload journeys |
| Voting | Name, preset Micah face, tint, unselected ballot, choice-aware CTA, final confirmation | Mobile and keyboard journeys |
| Returning voter | The same turn token shows a counted vote after refresh; Next voter clears identity and selections | Mobile voting loop |
| Suggestions | Named modal input; pending items absent from ballot; attribution remains after approval | Suggestion/moderation journeys and unit tests |
| Moderation | Add it with zero votes, Not this time, persistent Undo, focus management | Moderation and cross-tab journeys |
| Honest results | Exact counts with percentages, per-person ticks up to 20, leader-relative bars, explicit ties | Result screenshots, tie/large-crew journeys |
| Updates | Immediate on this device; other browser tabs refresh without losing the current field or draft | Cross-tab journey; throttled summary announcer |
| Closing | Deadline on read and while open; early close; closed ballots reject new votes | State-machine and storage-failure tests |
| Reveal | Winner or explicit tie, attribution for each option, closed landing for late voters | Mobile tie reveal and closed-results journeys |
| Reopening | Confirmation, new deadline, original votes retained | Reopening unit and browser tests |
| Portable result | Copy result text and generated PNG; zero-vote and tie outcomes supported | Clipboard payload and PNG download journeys |
| Responsive/accessibility | 320px reflow, 200% text, long user text, keyboard controls, native dialogs, status messages | Browser reflow/keyboard/axe checks |
| Resilience | Storage validation, no silent overwrite, failed-vote retry, avatar fallback, designed missing-poll state | Resilience browser suite |

The **share card** is the selected differentiator. Dark mode, templates, automatic retirement, and sudden-death rounds are optional and are not claimed.

## Submission boundary

The local product, source, screenshots, production files, and ZIP are the deliverables. No remote infrastructure is created by any build, test, preview, or packaging script. A public URL and a real-device check would still be needed for an eventual Frontend Mentor platform submission; publishing is excluded by the developer's current instruction.

See [QA.md](QA.md) for recorded checks and remaining manual verification limits. Automated accessibility checks are not a WCAG certification.

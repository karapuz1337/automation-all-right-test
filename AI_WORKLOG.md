# AI worklog

[Agent instructions](AGENTS.md) describe the test and evidence rules used for this assessment.

## Key prompts

These are short, verbatim excerpts from the worker task briefs. Surrounding text is omitted; no wording inside the quotes has been changed.

| Task | Prompt excerpt |
| --- | --- |
| UI implementation | "Implement nine independent UI cases AC-01–09 with TS Playwright" |
| API implementation | "AC-12 one read-only documented missing ID, assert 404 without touching other records." |
| CI workflow | "Draft concise current GitHub Actions workflow on push" |
| Independent QA | "each AC-01–12 exactly once isolated with per-case grep, then one full 12-case run with preserved HTML." |

## Mistakes and corrections

| Mistake | How it was caught and corrected |
| --- | --- |
| The first AC-03 assertion read prices immediately after selecting the sort, including hidden entries. | Code review found it could pass without proving the visible catalog was sorted. The corrected assertion waits for visible prices to be in numeric order, with at least two distinct values. |
| AC-12 assumed a large positive ID was unused in the shared demo. | Independent QA got `200` both in isolation and in the first full run. The test discarded the unexpected body; the reason for the response was not diagnosed. A fixed ID outside the positive range returned `404` with `Not Found` without weakening either assertion. This was a test design mistake, not a confirmed product bug. |
| The first API spec mixed HTTP transport, token handling, cleanup, and the booking scenario in one file. | The author compared it with the UI suite and their own Playwright project, pointed out that it was hard to read, and asked for `async`/`await`. The rewrite moved transport into `booker-client.ts` and left the API calls and assertions in the spec. |
| UI failures lacked browser evidence. | The author asked to carry over fitting settings from their Playwright workspace and later explicitly asked for traces to make failures easier to analyze. UI failures now attach a screenshot and retain a local trace. API captures and CI traces remain off. |
| AC-06 did not assert the checkout total. | The author requested a coverage review and called out checkout totals as a gap to close after the review flagged it. AC-06 now checks the cart price, subtotal, and total plus displayed tax arithmetic. |

The author also questioned the explicit five-second assertion timeout. It duplicated Playwright's default and was removed; the sort test still needs its own `toPass` timeout.

## Verification

Independent QA verified a clean lockfile install, type checking, discovery of both projects, and 12 passes in the corrected full run on Node 24 (9 UI, 3 API, no failures, skips, or retries). AC-12 passed in isolation after the fix; the other 11 isolated passes came from the prior QA round and their tests and configuration were unchanged. QA opened the full HTML report in Chromium. The original run did not confirm a product bug. Follow-up testing confirmed [SD-01](README.md#sd-01-checkout-accepts-a-postal-code-containing-only-spaces).

The [initial feature-branch CI run](https://github.com/karapuz1337/automation-all-right-test/actions/runs/45596242171) succeeded. The downloaded report matched the artifact digest and showed all 12 passes. Inspecting its embedded data exposed Git identity metadata, so the report configuration now explicitly omits commit and diff metadata. The follow-up also adds TypeScript/Playwright linting and a GitHub Actions run summary.

## Time and AI usage

Manual estimate for the same core automation without AI: **185–280 minutes**. This is a sequential estimate, not measured time. It covers setup (20–30 min), UI (55–80), API (35–50), CI (20–35), docs and review (35–50), and delivery (20–35). It excludes the bonus and does not count initial discovery and planning as core execution.

The table lists measured task intervals unless marked as worker session time (first to last recorded message). Setup overlapped with local tooling; UI and API implementation, CI, and the docs draft also overlapped. Don't add these intervals to calculate elapsed wall time. The initial hosted run succeeded **32m 52s after plan approval**. Report review and follow-up changes are recorded separately below. The pre-core interval includes discovery, plan review, and stopped partial setup; initial planning time was not captured.

Token columns show observed worker counters. Grouped rows sum recorded counters only; they are not billing totals. Coordinator tokens are not reliably attributed. Worker counters are available for documentation finalization, but its elapsed time was not verified.

| Task | Elapsed | Input | Output | Cache creation | Cache read | Thinking |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Pre-core discovery, specification, planning, and partial setup | 12m 16s recorded (discovery: 1m 39s within that interval) | 1,312 | 33,989 | 429,352 | 959,390 | 4,552 |
| Playwright setup and zero-test baseline | 2m 31s | 240 | 5,698 | 37,240 | 244,857 | 248 |
| Local tooling setup | 2m 52s | 280 | 11,208 | 65,670 | 657,151 | 1,126 |
| UI implementation | 1m 13s | 160 | 5,191 | 36,666 | 198,222 | 627 |
| API implementation | 1m 53s | 280 | 9,203 | 38,432 | 380,488 | 1,241 |
| Code, defensive, and simplicity review (including re-review tokens) | 64.503 / 44.638 / 88.298s initial worker sessions; re-review elapsed unavailable | 880 | 11,440 | 206,092 | 1,042,008 | 869 |
| UI sort correction | 87.559s worker session | 677 | 4,829 | 26,965 | 216,399 | 574 |
| API cleanup correction | 1m 08s | 200 | 4,666 | 24,544 | 180,040 | 341 |
| Initial independent QA | 5m 19s | 1,904 | 16,056 | 71,620 | 1,698,797 | 1,442 |
| Missing-ID fixture correction | 17s observed | 160 | 2,377 | 23,034 | 137,591 | 49 |
| Corrected clean-snapshot QA | 58.682s (full run: 9.017s within that interval) | 220 | 7,132 | 38,392 | 277,881 | 59 |
| CI workflow draft | 1m 31s | 280 | 5,380 | 35,516 | 349,589 | 953 |
| Documentation draft | 58s | 200 | 4,434 | 39,239 | 267,331 | 206 |
| Documentation finalization | Not verified | 220 | 5,450 | 36,315 | 288,983 | 273 |
| Hosted report verification | 2m 13s | 340 | 9,570 | 40,702 | 480,665 | 840 |
| TypeScript/Playwright lint and pre-commit | 3m 03s | 420 | 9,172 | 46,683 | 649,530 | 946 |
| GitHub Actions summary | 1m 52s | 360 | 7,978 | 37,902 | 432,903 | 820 |

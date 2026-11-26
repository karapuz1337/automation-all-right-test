# Agent instructions

## Scope

- Keep SauceDemo UI cases (AC-01–09) and Restful Booker API cases (AC-10–13) in separate Playwright projects. Keep the SD-01 reproduction opt-in and the generator out of core test discovery.
- Give each core case an acceptance ID and make it runnable on its own. Use fresh browser contexts, explicit setup and assertions, stable locators, and Playwright's built-in waits. Do not rely on another test's login, cart, or booking.

## Data and evidence

- Use only synthetic test data and documented public demo credentials. Update or delete only the validated booking ID returned by the current test's successful creation request. If creation is ambiguous and no ID was recovered, report it. Do not search for a cleanup target or retry the write. Keep cleanup bounded and preserve the original failure.
- Assert the expected validation behavior. Distinguish application responses from timeouts, rate limits, and service errors. Do not put issued tokens, cookies, raw authentication payloads, private credentials, or personal data in logs, reports, or examples.

## Verification

- Use Node 24 and install from the lockfile with `npm ci`. Run `npm run lint`, `npm run typecheck`, and `npm test -- --list`. Run each affected case in isolation, for example `npm test -- --project=ui --grep AC-08`, then run `npm test`.
- Record the checks and outcomes you observed. Keep local artifacts under `.runtime/` and verify hosted results against the exact commit. Do not publish without approval. Local `.factory/` settings are not required to run the suite.

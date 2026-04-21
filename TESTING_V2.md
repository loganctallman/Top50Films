# Testing Strategy — Top50Films

## Overview

This document describes the testing philosophy, architecture, tooling, and CI/CD integration for the Top50Films project. The suite is designed to give high confidence in correctness, performance, accessibility, and cross-platform behaviour while keeping feedback loops short and the deploy pipeline fast.

---

## Test Pyramid

```
        ┌─────────────────────────────────┐
        │      Performance Budget         │  ← Lighthouse CI
        ├─────────────────────────────────┤
        │      Visual Regression          │  ← Playwright screenshots
        ├─────────────────────────────────┤
        │   Cross-Browser & Mobile E2E    │  ← Firefox, WebKit, Pixel 5, iPhone 14
        ├─────────────────────────────────┤
        │      E2E / Browser (Primary)    │  ← Playwright Chromium
        ├─────────────────────────────────┤
        │   API Contract Validation       │  ← JSON Schema + AJV (handler output + upstream monitor)
        ├─────────────────────────────────┤
        │      API / Integration          │  ← Vitest + MSW (serverless handlers)
        ├─────────────────────────────────┤
        │      Unit / Component           │  ← Vitest + Testing Library
        └─────────────────────────────────┘
```

Each layer answers a different question:

| Layer | Question | Scope |
|---|---|---|
| Unit / Component | Does the logic do what it claims? | Pure functions, Svelte components in isolation |
| API / Integration | Do the serverless handlers respond correctly? | Vercel edge functions, input validation, response shape |
| API Contract Validation | Do our handler outputs still match the agreed schema? Is TMDB still returning the fields we depend on? | JSON Schema compliance, E2E fixture drift, weekly upstream probe |
| E2E (Primary) | Does the app work end-to-end in a real browser? | Full user journeys, routing, state persistence |
| Cross-Browser & Mobile | Does it work the same everywhere? | Firefox, WebKit, Pixel 5, iPhone 14 |
| Visual Regression | Did the UI change unexpectedly? | Screenshot comparison across all pages and key states |
| Performance Budget | Does the app stay within delivery constraints? | Core Web Vitals, bundle size, Lighthouse scores |

---

## Tooling

| Tool | Role |
|---|---|
| **Vitest** | Unit + API test runner — native ESM, Vite-aware, near-zero config |
| **@testing-library/svelte** | Component rendering with user-centric queries |
| **MSW (Mock Service Worker)** | API mocking at the network layer — same code path as production |
| **Playwright** | E2E browser automation — Chromium, Firefox, WebKit, mobile devices |
| **axe-playwright** | Automated WCAG 2.1 AA accessibility auditing inside E2E runs |
| **AJV (Another JSON Schema Validator)** | JSON Schema v7 validation for handler output and upstream contract monitoring |
| **@lhci/cli** | Lighthouse CI with assertion-level performance budget enforcement |
| **@vitest/coverage-v8** | V8 native coverage instrumentation — no Babel overhead |

---

## Unit Tests (`src/**/*.test.js`)

**Runner:** Vitest · **Environment:** jsdom

### What is unit-tested

- **Business logic** (`src/lib/logic/`) — cache expiration, favorites deduplication, notification generation, suggestion ranking. Pure functions with no framework dependency; highest-value targets for unit coverage.
- **Svelte components** (`src/lib/components/`) — rendered via `@testing-library/svelte`. Tests assert on DOM output and user interactions, not component internals.
- **Storage service** (`src/lib/services/storageService.test.js`) — localStorage abstraction with a jsdom-compatible mock.
- **Page components** (`src/pages/*.test.js`) — Settings and TrialTracker rendered in isolation with mocked stores.

### What is NOT unit-tested (by design)

- API response shapes — covered at the API layer
- Multi-page routing flows — covered at E2E
- Real DOM layout/paint — covered by Lighthouse

### Test setup (`src/test/setup.js`)

1. **MSW server** — intercepts all `fetch` calls; components never hit a real network
2. **jest-dom matchers** — `toBeInTheDocument`, `toHaveTextContent`, etc.
3. **localStorage mock** — resets between each test via `src/test/mockStorage.js`
4. **Store reset** — `src/test/resetStores.js` clears Svelte writable stores after each test

### Running

```bash
npm run test:unit       # single run
npm run test:coverage   # with v8 coverage (output: coverage/)
npm test                # watch mode
```

---

## API / Integration Tests (`api/**/*.test.js`)

**Runner:** Vitest · **Environment:** node

These tests exercise each Vercel serverless handler end-to-end within Node. MSW mocks the upstream TMDB API, allowing full validation of request handling, parameter parsing, response normalisation, and error paths — without network calls.

### Coverage

| Handler | Key scenarios |
|---|---|
| `genre-top50` | Genre filtering, pagination, unknown genre |
| `search` | Film search, empty results, 500 from upstream |
| `providers` | Streaming provider list, normalisation |
| `suggestions` | Recommendation algorithm, store integration |
| `movie/:id` | Movie detail + watch providers, missing ID |
| `person/search` | Director/actor search, empty, partial match |
| `person/:id` | Filmography fetch, fallback on missing data |

### Why MSW over `vi.mock`

MSW intercepts at the HTTP level, meaning the production `fetch` code path runs unchanged. Mocking the fetch function or module can mask real bugs in how the handler constructs request URLs, handles query params, or processes response bodies.

### Note on deployment

`api/**/*.test.js` and `api/schemas/` are excluded from Vercel deployments via `.vercelignore`. Without this, Vercel would count test files and schema helpers as serverless functions and exceed the Hobby plan limit of 12.

---

## API Contract Validation (`api/schemas/`)

**Runner:** Vitest (unit) + Node.js (upstream monitor) · **Workflow:** `contract-monitor.yml` · **CI behaviour:** Gates deploy (unit) / Weekly schedule (monitor)

Contract validation sits between API/integration tests and E2E. It answers two questions that neither layer handles well: *did our normalisation logic stop emitting a required field?* and *did TMDB silently change the fields we depend on?*

### Validation layers

#### Layer 0 — validate() utility tests (`api/schemas/validate.test.js`)

`validate.test.js` tests the AJV helper itself — the detection mechanism that all other contract tests depend on. Covers: throws on violation with the correct message format (schema ID + field path), `(root)` fallback when `instancePath` is empty, nested field path in message, null/undefined data, unregistered schema IDs, and a SCHEMAS exhaustiveness check that verifies every `SCHEMAS` constant value resolves to a registered AJV schema (so a new schema file added to the registration list but not to the `SCHEMAS` export is caught immediately).

#### Layer 1 — Handler output schema compliance (unit tests)

`api/schemas/contracts.test.js` invokes each handler with realistic mocked TMDB data and validates both the **200 response** and **error envelope** against the appropriate JSON Schema. Runs on every push as part of the normal unit test suite.

| Test | Schema |
|---|---|
| `GET /api/providers` — 200 | `providers-response` |
| `GET /api/genre-top50` — 200 | `genre-top50-response` |
| `GET /api/search` — 200 | `search-response` |
| `GET /api/suggestions` — 200 | `suggestions-response` |
| `GET /api/movie/:id` — 200 | `movie-response` |
| `GET /api/person/search` — 200 | `person-search-response` |
| `GET /api/person/:id` — 200 | `person-filmography-response` |
| `GET /api/search` — 400 (missing param) | `error-response` |
| `GET /api/search` — 503 (upstream failure) | `error-response` |
| `GET /api/genre-top50` — 503 | `error-response` |
| `GET /api/movie/:id` — 503 | `error-response` |
| `GET /api/person/search` — 503 | `error-response` |

#### Layer 2 — E2E fixture drift detection (unit tests)

The same `contracts.test.js` file validates all MSW/Playwright fixtures in `tests/e2e/helpers.js` against the same schemas. This catches mock data drifting out of sync with the real handler contract — a common failure mode as handlers evolve. During implementation, this layer caught a real bug: `fixtures.genreResults` contained `total_pages` and `page` fields that the `genre-top50` handler never returns, silently violating `additionalProperties: false`.

| Fixture | Schema |
|---|---|
| `fixtures.providers` | `providers-response` |
| `fixtures.genreResults` | `genre-top50-response` |
| `fixtures.searchResults` | `search-response` |
| `fixtures.suggestions` | `suggestions-response` |
| `fixtures.movieWithProviders` | `movie-response` |
| `fixtures.personSearch` | `person-search-response` |
| `fixtures.personFilmography` | `person-filmography-response` |

#### Layer 3 — TMDB upstream contract monitor (weekly CI job)

`.github/scripts/contract-monitor.js` calls the **real TMDB API** (no mocking) with known-stable IDs:

| Resource | TMDB ID |
|---|---|
| The Godfather | 238 |
| Francis Ford Coppola | 1032 |
| Drama genre | 18 |

It passes each response through the handler's normalisation logic and validates the output against the same JSON Schemas. If any violation is found, the job writes a `contract-failures.txt` file and opens a deduplicated GitHub Issue labelled `contract-violation`.

### Schema architecture

Schemas live in `api/schemas/` and use `$ref` composition to avoid duplication:

```
film.json              ← reusable film object (tmdb_id, title, year, vote_average, watch_providers…)
watch-provider.json    ← reusable provider object (provider_id, name, logo_path, type enum)
error-response.json    ← shared error envelope { error: true, message, status }
│
├── genre-top50-response.json        $ref film
├── search-response.json             $ref film
├── suggestions-response.json        $ref film
├── movie-response.json              $ref watch-provider
└── person-filmography-response.json $ref film
```

All schemas use `additionalProperties: false` so that new unexpected fields from TMDB surface immediately rather than silently passing validation.

### Running

```bash
# Handler output + fixture drift (runs with the normal unit suite)
npm run test:unit

# Upstream monitor against real TMDB API (requires key)
TMDB_API_KEY=<key> node .github/scripts/contract-monitor.js
```

### Why the upstream monitor runs on a schedule, not on every push

TMDB's API is stable but not versioned. Changes are rare and not announced. Running on a weekly schedule is sufficient to catch silent upstream breakage before it affects users, without adding a network-dependent step to the hot deploy path.

---

## E2E Tests (`tests/e2e/*.spec.js`)

**Runner:** Playwright · **Primary browser:** Chromium · **Retries:** 2× in CI

The E2E suite is the main regression safety net. Tests run against the production build served by `vite preview`, giving the highest fidelity to what users actually receive.

### Test inventory

| Spec | Coverage |
|---|---|
| `onboarding.spec.js` | Two-step onboarding gate, persistence after page reload |
| `addToList.spec.js` | Genre browse, film search, person search, streaming provider filter |
| `myList.spec.js` | Favorites management, empty state, removal, 50/50 limit |
| `notifications.spec.js` | Empty and populated notification states, dismissal |
| `settings.spec.js` | Provider filter toggles, settings persistence |
| `cache.spec.js` | API call counting — verifies cache prevents redundant TMDB fetches |
| `offline.spec.js` | Offline detection, localStorage fallback via `context.setOffline()` |
| `chaos.spec.js` | API 500s, empty results, malformed responses, edge-case data |
| `accessibility.spec.js` | axe-core WCAG 2.1 AA sweep across all pages and states |
| `visual.spec.js` | Screenshot regression across all pages — see Visual Regression section |

### Design conventions

- **`page.route()` for API mocking** — handlers return realistic TMDB fixtures from `tests/e2e/helpers.js`. No live network calls in CI.
- **Wait-for-state over fixed sleeps** — all assertions use `expect(locator).toBeVisible()` and `waitForResponse`, never `page.waitForTimeout`.
- **Animations frozen** — `addInitScript` injects `animation-duration: 0s; transition: none` before each test.
- **2× retries in CI** — a test that fails more than 50% of the time in a two-week window is promoted to a bug.

### Shared helpers (`tests/e2e/helpers.js`)

- Fixture data matching the TMDB response shape
- `seedStorage(page, data)` — preloads localStorage before navigation
- `mockAllApis(page)` — registers `page.route()` stubs for all `/api/*` endpoints
- `makeCacheEntry(tmdb_id, providers)` — builds a fresh, non-expired streaming cache entry

### Running

```bash
npm run test:e2e        # Chromium only (fast, local dev)
npm run test:e2e:ui     # Playwright UI mode
npm run test:e2e:all    # All configured browsers and devices
```

---

## Accessibility Testing

Validated at two levels:

1. **Automated (E2E)** — `accessibility.spec.js` runs `checkA11y()` (axe-core via `axe-playwright`) on every page and on key interaction states (modal open, empty list, error state). Any WCAG 2.1 AA violation fails the build.

2. **Structural (unit)** — component tests use semantic queries (`getByRole`, `getByLabel`), so a semantically broken component also breaks its unit tests.

### What automated tooling cannot catch

- Colour contrast in dynamic themes
- Focus trap correctness in complex modals
- Screen reader announcement ordering

These are addressed in manual test checklists and reviewed during code review.

---

## Cross-Browser & Mobile Testing

**Runner:** Playwright · **Workflow:** `cross-browser.yml` · **CI behaviour:** Informational

The primary E2E suite runs Chromium only to keep the deploy pipeline fast (< 5 minutes). The cross-browser workflow runs in parallel as a matrix of four additional configurations, each in its own CI job.

### Browser matrix

| Project | Engine | Viewport | Purpose |
|---|---|---|---|
| `firefox` | Firefox | 1280×720 | Second most-used desktop browser; distinct layout engine |
| `webkit` | WebKit | 1280×720 | Safari desktop rendering — critical for macOS/iOS users |
| `mobile-chrome` | Chromium | 393×851 (Pixel 5) | Android mobile experience; PWA install flow |
| `mobile-safari` | WebKit | 390×844 (iPhone 14) | iOS mobile experience; dominant mobile browser in many markets |

### What cross-browser tests cover

All functional E2E specs run on every browser — same test code, different rendering engines. This catches:
- CSS layout bugs (flexbox/grid differences between engines)
- JavaScript API availability differences
- Touch event handling on mobile viewports
- PWA behaviour differences across platforms

### What cross-browser tests do NOT cover

- Visual pixel-perfection — that is the job of Visual Regression (Chromium only)
- Performance — Lighthouse runs in Chromium only

### Why informational, not gating

Cross-browser E2E adds significant CI time (~4× the Chromium-only run). Making it a hard deploy gate would mean a WebKit-only rendering quirk blocks a critical fix from shipping. Instead, failures surface as ⚠️ warnings in the GitHub Actions summary. The engineering team reviews the report and decides whether to block before merging.

To make it gating: remove `continue-on-error: true` from `cross-browser.yml` and add `needs: [cross-browser]` to the deploy job in `ci.yml`. That is a two-line change.

### Note on local development

WebKit requires macOS 13+. On macOS 12 or Linux without system deps, run only what is available:

```bash
npm run test:e2e:cross-browser -- --project=firefox --project=mobile-chrome
```

CI always runs the full matrix on Ubuntu where all browsers are supported.

---

## Visual Regression

**Runner:** Playwright · **Workflow:** `visual.yml` · **CI behaviour:** Informational

### What it tests

8 snapshots covering all 5 pages in their key states:

| Snapshot | Page | State |
|---|---|---|
| `home.png` | Home | Suggestions loaded |
| `add-genre-browse.png` | Add to List | Genre browse default |
| `add-search-results.png` | Add to List | Search results visible |
| `my-list-empty.png` | My List | Empty state |
| `my-list-populated.png` | My List | 2 films seeded |
| `notifications-empty.png` | Notifications | No streaming films |
| `notifications-populated.png` | Notifications | 2 films on Netflix |
| `settings.png` | Settings | Providers loaded |

### Determinism strategy

Three factors make screenshots non-deterministic in a data-driven app. All three are neutralised:

| Factor | Solution |
|---|---|
| External API data | All `/api/*` routes mocked with fixed fixtures via `page.route()` |
| TMDB image CDN | `**image.tmdb.org/**` intercepted and replaced with a 1×1 grey PNG placeholder |
| Relative timestamps ("2 weeks ago") | `Date.now` frozen to `2024-01-15T12:00:00Z` via `page.addInitScript` |

### Browser scope

Visual regression runs on **Chromium only**. Exclusion is enforced at the config level via `testIgnore` on every non-Chromium project:

```js
{ name: 'firefox',       use: { ...devices['Desktop Firefox'] }, testIgnore: /visual\.spec/ },
{ name: 'webkit',        use: { ...devices['Desktop Safari'] },  testIgnore: /visual\.spec/ },
{ name: 'mobile-chrome', use: { ...devices['Pixel 5'] },         testIgnore: /visual\.spec/ },
{ name: 'mobile-safari', use: { ...devices['iPhone 14'] },       testIgnore: /visual\.spec/ }
```

Config-level exclusion is preferred over a runtime `test.skip` because it is enforced at collection time (the file is never loaded for non-Chromium projects) and does not depend on a string match against the project name surviving a rename.

### Why informational, not gating

Visual regression cannot be reliably hard-gated in CI for two reasons:

1. **Platform rendering variance** — macOS and Linux render fonts at the sub-pixel level differently. A screenshot taken on a macOS dev machine and compared on a Linux CI runner will produce false positives even for unchanged code.

2. **Intentional vs unintentional change** — automated CI cannot distinguish a regression from a deliberate design update. The same pixel diff may mean "bug" or "approved change". A human reviewer can; a CI gate cannot.

`maxDiffPixelRatio: 0.03` (3% of pixels) absorbs rendering variance while still catching meaningful layout regressions. The full diff report is uploaded as a CI artifact on every run.

**Industry precedent:** Percy, Chromatic, and Applitools — the three leading visual regression platforms — all use a human-review model rather than a hard CI gate for the same reasons.

**Upgrade path:** Once baselines are stable and the team has calibrated tolerance per component, set `continue-on-error: false` in `visual.yml`. One-line change.

### Updating baselines

```bash
npm run test:visual -- --update-snapshots
git add tests/snapshots/
git commit -m "chore: update visual regression baselines"
```

---

## Performance Budget

**Tool:** Lighthouse CI (`@lhci/cli`) · **Config:** `lighthouserc.json` · **Workflow:** `performance.yml`

### Thresholds

| Metric | Budget | Severity |
|---|---|---|
| Lighthouse Performance Score | ≥ 90 | error |
| Lighthouse Accessibility Score | ≥ 90 | error |
| Lighthouse Best Practices Score | ≥ 90 | error |
| Lighthouse SEO Score | ≥ 80 | warn |
| First Contentful Paint | ≤ 1800 ms | error |
| Largest Contentful Paint | ≤ 2500 ms | error |
| Cumulative Layout Shift | ≤ 0.1 | error |
| Total Blocking Time | ≤ 300 ms | error |
| Time to Interactive | ≤ 3800 ms | error |
| Speed Index | ≤ 3400 ms | warn |
| JS bundle (transferred) | ≤ 350 KB | error |
| CSS (transferred) | ≤ 50 KB | warn |
| Total page weight | ≤ 1 MB | warn |
| Text compression | enabled | error |
| Modern image formats | pass | warn |

Thresholds map to the **"Good" tier** in Google's Core Web Vitals program. `error` assertions fail the CI job; `warn` assertions appear in the report without blocking merge.

### Methodology

- 3 runs averaged per URL to reduce JIT/GC variance
- Tests run against the **production Vite build** (`npm run build && vite preview`) — the dev server is unminified and would give misleading results
- Desktop preset, minimal throttling — CI runner CPU constraints make artificial throttling non-reproducible
- Three representative routes: `/` (home), `/#/add` (data-heavy browse), `/#/my-list` (list management)

### Running locally

```bash
npm run build
npm run test:perf
# report written to .lighthouseci/ and uploaded to LHCI temporary public storage
```

---

## AI-Assisted QA Agents

Two GitHub Actions workflows extend the suite with LLM-based analysis using the Anthropic API:

### `qa-agent-failures.yml`

Triggered when CI fails. Calls Claude Sonnet to:
1. Parse failing job logs
2. Cross-reference failing tests against source files
3. Distinguish genuine regressions from infrastructure flakiness
4. Open a GitHub Issue with root cause, affected files, recommended fix, and flakiness indicator

### `qa-agent-coverage.yml`

Triggered on every PR that touches source or test files. Reviews the diff and existing test files to:
1. Identify new code paths with no test coverage
2. Rate gap severity (critical / moderate / low)
3. Post a PR comment with specific test suggestions

Both agents use `.github/scripts/qa-agent.js` which collects context (test files, job logs, PR diff) before calling the API, keeping token usage predictable.

---

## CI/CD Pipeline

```
push / PR
    │
    ├── unit (Vitest)                      gates deploy
    │     └─ vitest run
    │         includes contracts.test.js (handler schema + fixture drift)
    │
    ├── e2e (Playwright — Chromium only)   gates deploy
    │     └─ playwright test --project=chromium
    │         build + vite preview via webServer config
    │
    ├── performance (Lighthouse CI)        informational
    │     └─ npm run build → lhci autorun
    │         3 URLs × 3 runs, report artifact (30d)
    │
    ├── visual (Playwright snapshots)      informational
    │     └─ npm run build → playwright test visual.spec.js --project=chromium
    │         8 snapshots, diff report artifact (30d)
    │
    ├── cross-browser (Playwright matrix)  informational
    │     └─ [firefox] [webkit] [mobile-chrome] [mobile-safari]
    │         4 parallel jobs, per-browser report artifacts (14d)
    │
    └── deploy (Vercel) — main branch only, needs unit + e2e green
          └─ vercel build --prod && vercel deploy --prebuilt

weekly schedule (Monday 08:00 UTC)
    │
    └── contract-monitor (Node.js)         opens GitHub Issue on failure
          └─ real TMDB API calls → normalise → validate against JSON Schemas
              known-stable IDs: Godfather/238, Coppola/1032, Drama/18
              failure artifact: contract-failures.txt (30d)
```

### Key pipeline decisions

| Decision | Rationale |
|---|---|
| Chromium-only gates deploy | Keeps the deploy-blocking pipeline under 5 minutes |
| Contract unit tests gate deploy; upstream monitor does not | Schema compliance of our own code must be fast and reliable; upstream TMDB health is checked weekly to avoid network dependency on the hot deploy path |
| Cross-browser, visual, performance are informational | Failures are real signals but carry higher false-positive rates; humans review before merging |
| E2E uses `--project=chromium` explicitly in CI | Adding new Playwright projects can never accidentally affect deploy gate speed |
| Vercel CLI pinned to `latest` | Vercel bumps minimum CLI version requirements without notice; pinning causes deploy failures |
| `api/**/*.test.js` and `api/schemas/` excluded via `.vercelignore` | Prevents test files and schema helpers being counted as serverless functions (Hobby plan limit: 12) |

---

## Coverage

Collected with `@vitest/coverage-v8`, reported as HTML + JSON to `coverage/`.

```bash
npm run test:coverage
open coverage/index.html
```

**Scope:** `src/lib/**/*.js` + `api/**/*.js`

**Current approach:** Coverage is measured and reported but not hard-gated in CI. The rationale: a 95%-covered file with shallow assertions is less valuable than an 80%-covered file with meaningful scenarios. The AI coverage agent (`qa-agent-coverage.yml`) provides semantic gap analysis on every PR — a stronger signal than a line-count threshold.

---

## Local Development Workflow

```bash
# Before starting new work — keeps Dev in sync with main
git pull origin main

# Fast feedback — unit tests in watch mode
npm test

# E2E changes — targeted Chromium run
npm run test:e2e

# Cross-browser check (Firefox + Android Chrome available everywhere)
npm run test:e2e:cross-browser -- --project=firefox --project=mobile-chrome

# Before opening a PR
npm run test:unit
npm run test:e2e
npm run test:coverage

# Performance spot-check (requires clean build)
npm run build && npm run test:perf

# Visual baseline update after intentional UI changes
npm run test:visual -- --update-snapshots
git add tests/snapshots/ && git commit -m "chore: update visual baselines"
```

---

## Conventions

### Test file location

| What | Where |
|---|---|
| Logic / service unit tests | Co-located with source (`*.test.js` next to `*.js`) |
| Component tests | Co-located with the Svelte component |
| API handler tests | Co-located with the handler (`api/`) |
| API contract tests, schemas, validate utility | `api/schemas/` |
| E2E specs | `tests/e2e/` |
| Visual baselines | `tests/snapshots/visual.spec.js/` |

### Naming

- Test files: `*.test.js` (unit/API), `*.spec.js` (E2E)
- Describe blocks: the thing under test — `describe('favoritesLogic', ...)`
- It blocks: behaviour in present tense — `it('removes a film from the list')`

### Mocking philosophy

- Mock at the **boundary** — external HTTP (MSW), localStorage, Svelte stores. Never mock the module under test itself.
- Fixtures live in `tests/e2e/helpers.js` (E2E) and `src/mocks/` (unit). Keep them realistic — they must match the actual TMDB response shape.

### Do not write tests that

- Assert on CSS classes or implementation-specific element IDs
- Sleep with a fixed timeout to wait for async state
- Pass only because retries masked a genuine failure
- Mock the module under test itself

---

## Known Gaps and Roadmap

| Gap | Priority | Notes |
|---|---|---|
| Coverage gating in CI | Medium | Infrastructure ready; decision pending on per-module thresholds |
| Cross-browser baseline calibration | Medium | Currently all cross-browser failures are informational; needs threshold review after 2–4 weeks of data |
| Visual regression — multi-browser baselines | Low | Currently Chromium-only; Firefox/WebKit baselines would require separate snapshot sets |
| WebKit on macOS 12 | Low | Local WebKit testing not available on macOS 12; resolved by upgrading OS |

---

## Appendix: Running the Full Suite

```bash
# First-time setup
npm ci
npx playwright install --with-deps chromium firefox
# webkit requires macOS 13+ or Linux

# Full suite
npm run test:unit
npm run test:e2e
npm run test:e2e:cross-browser
npm run test:coverage
npm run test:visual

# Performance budget (requires clean build)
npm run build
npm run test:perf
```

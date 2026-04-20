# Testing Strategy — Top50Films

## Overview

This document describes the testing philosophy, architecture, tooling, and CI/CD integration for the Top50Films project. The suite is designed to give high confidence in correctness, performance, and accessibility while keeping feedback loops short.

---

## Test Pyramid

```
           ┌───────────────────────┐
           │   Performance Budget  │  ← Lighthouse CI (build artifact)
           ├───────────────────────┤
           │     E2E / Browser     │  ← Playwright + axe-core
           ├───────────────────────┤
           │    API / Integration  │  ← Vitest + MSW (serverless handlers)
           ├───────────────────────┤
           │   Unit / Component    │  ← Vitest + Testing Library
           └───────────────────────┘
```

Each layer answers a different question:

| Layer | Question | Scope |
|---|---|---|
| Unit / Component | Does the logic do what it claims? | Pure functions, Svelte components in isolation |
| API / Integration | Do the serverless handlers respond correctly? | Vercel edge functions, input validation, response shape |
| E2E | Does the app work end-to-end in a real browser? | Full user journeys, routing, state persistence |
| Performance Budget | Does the app stay within delivery constraints? | Core Web Vitals, bundle size, Lighthouse scores |

---

## Tooling Choices

| Tool | Role | Why |
|---|---|---|
| **Vitest** | Unit + API test runner | Native ESM, Vite-aware, near-zero config |
| **@testing-library/svelte** | Component rendering | User-centric queries over implementation details |
| **MSW (Mock Service Worker)** | API mocking in unit tests | Intercepts `fetch` at the network layer — same code path as production |
| **Playwright** | E2E browser automation | Cross-browser, reliable auto-waits, built-in trace/screenshot on failure |
| **axe-playwright** | Accessibility auditing | Automated WCAG 2.1 AA checks integrated directly into E2E runs |
| **@lhci/cli** | Performance budgets | Lighthouse CI with assertion-level thresholds enforced in CI |
| **@vitest/coverage-v8** | Coverage reporting | V8 native instrumentation — no Babel transform overhead |

---

## Unit Tests (`src/**/*.test.js`)

**Runner:** Vitest · **Environment:** jsdom

### What is unit-tested

- **Business logic** (`src/lib/logic/`) — cache expiration, favorites deduplication, notification generation, suggestion ranking. These are pure functions with no framework dependency and are the highest-value targets for unit coverage.
- **Svelte components** (`src/lib/components/`) — rendered via `@testing-library/svelte`. Tests assert on DOM output and user interactions, not on component internals.
- **Storage service** (`src/lib/services/storageService.test.js`) — localStorage abstraction with a jsdom-compatible mock.
- **Page components** (`src/pages/*.test.js`) — Settings and TrialTracker rendered in isolation with mocked stores.

### What is NOT unit-tested (by design)

- API response shapes (covered at the API layer)
- Multi-page routing flows (covered at E2E)
- Real DOM layout/paint (covered by Lighthouse)

### Test setup

`src/test/setup.js` wires up:

1. **MSW server** — intercepts all `fetch` calls so components never hit a real network
2. **jest-dom matchers** — `toBeInTheDocument`, `toHaveTextContent`, etc.
3. **localStorage mock** — resets between each test via `src/test/mockStorage.js`
4. **Store reset** — `src/test/resetStores.js` clears Svelte writable stores after each test

### Running

```bash
npm run test:unit          # single run
npm run test:coverage      # with v8 coverage (output: coverage/)
npm test                   # watch mode
```

---

## API / Integration Tests (`api/**/*.test.js`)

**Runner:** Vitest · **Environment:** node

These tests exercise each Vercel serverless handler end-to-end within Node. MSW mocks the upstream TMDB API, allowing full validation of request handling, parameter parsing, response normalization, and error paths — without network calls.

### Coverage

| Handler | Key scenarios |
|---|---|
| `genre-top50` | Genre filtering, pagination, unknown genre |
| `search` | Film search, empty results, 500 from upstream |
| `providers` | Streaming provider list, normalization |
| `suggestions` | Recommendation algorithm, store integration |
| `movie/:id` | Movie detail + watch providers, missing ID |
| `person/search` | Director/actor search, empty, partial match |
| `person/:id` | Filmography fetch, fallback on missing data |

### Why MSW over `vi.mock`

MSW intercepts at the HTTP level, meaning the production `fetch` code path runs unchanged. A `vi.mock` on the fetch function or module can mask real bugs in how the handler constructs its request URL, handles query params, or processes the response body.

---

## E2E Tests (`tests/e2e/*.spec.js`)

**Runner:** Playwright · **Browser:** Chromium (CI), `--ui` mode locally

The E2E suite is the main regression safety net. It runs against the production build served by `vite preview`, giving the highest fidelity to what users actually receive.

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

### Design conventions

- **`page.route()` for API mocking** — handlers return realistic TMDB fixtures defined in `tests/e2e/helpers.js`. No live network calls in CI.
- **Wait-for-state over fixed sleeps** — all assertions use `expect(locator).toBeVisible()` and `waitForResponse` rather than `page.waitForTimeout`.
- **Animations frozen** — `page.addInitScript` injects CSS `animation-duration: 0s; transition: none` before each test to eliminate flakiness from motion.
- **2× retries in CI** — flaky tests get one retry before failing. Any test that fails more than 50% of the time in a two-week window is promoted to a bug.

### Shared helpers

`tests/e2e/helpers.js` provides:
- Fixture data for films, providers, people matching the TMDB response shape
- `seedFavorites(page, films)` — preloads localStorage before navigation
- `mockAllRoutes(page)` — registers `page.route()` stubs for all `/api/*` handlers in one call

### Running

```bash
npm run test:e2e        # headless Chromium
npm run test:e2e:ui     # Playwright UI mode (local dev)
```

---

## Accessibility Testing

Accessibility is validated at two levels:

1. **Automated (E2E)** — `accessibility.spec.js` runs `checkA11y()` (axe-core via `axe-playwright`) on every page and on key interaction states (modal open, empty list, error state). Any WCAG 2.1 AA violation fails the build.

2. **Structural (unit)** — component tests assert on semantic roles (`getByRole`, `getByLabel`) rather than test IDs, which means a semantically broken component also breaks its unit tests.

### What automated tooling cannot catch

- Colour contrast in dynamic themes
- Focus trap correctness in complex modals
- Screen reader announcement ordering

These are documented in manual test checklists and reviewed during code review.

---

## Performance Budget

**Tool:** Lighthouse CI (`@lhci/cli`) · **Config:** `lighthouserc.json`

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

Thresholds map to the **"Good" tier** in Google's Core Web Vitals program. `error` assertions fail the CI job; `warn` assertions appear in the report but do not block merge.

### Methodology

- Each URL is audited **3 times** and results are averaged to reduce variance from cold JIT and GC pauses.
- Tests run against the **production Vite build** (`npm run build && vite preview`), not the dev server — the dev build is unminified and unoptimised and would give misleading results.
- **Desktop preset, minimal throttling** — CI runners have constrained CPU/network; artificial throttling would make results non-reproducible. Budgets are set for desktop parity with the deployed Vercel environment.
- Three representative routes are tested: `/` (home), `/#/add` (data-heavy browse), `/#/my-list` (list management).

### Running locally

```bash
npm run build
npm run test:perf
```

Reports are written to `.lighthouseci/` and also uploaded to LHCI temporary public storage (URL printed to stdout).

---

## AI-Assisted QA Agents

Two GitHub Actions workflows extend the suite with LLM-based analysis:

### `qa-agent-failures.yml`

Triggered when CI fails. Calls Claude Sonnet via the Anthropic API to:

1. Parse the failing job logs
2. Cross-reference failing tests against the source files
3. Distinguish genuine regressions from infrastructure flakiness
4. Open a GitHub Issue with a structured breakdown: root cause, affected files, recommended fix, flakiness indicator

### `qa-agent-coverage.yml`

Triggered on every pull request that touches source or test files. Reviews the PR diff and existing test files to:

1. Identify new code paths with no test coverage
2. Rate gap severity (critical / moderate / low)
3. Post a PR comment with specific test suggestions

Both agents use `.github/scripts/qa-agent.js` which collects context (test files, job logs, PR diff) before calling the API, keeping token usage predictable.

---

## CI/CD Integration

```
push / PR
    │
    ├── unit (Vitest)
    │     └─ npm run test:unit
    │
    ├── e2e (Playwright)
    │     └─ npm run test:e2e
    │         build + vite preview managed by playwright webServer config
    │
    ├── performance (Lighthouse CI)         ← runs in parallel with unit + e2e
    │     └─ npm run build → lhci autorun
    │         report uploaded as artifact (30-day retention)
    │
    └── deploy (Vercel) — main branch only, needs unit + e2e green
          └─ vercel build --prod && vercel deploy --prebuilt
```

**Key pipeline decisions:**

- Performance runs in parallel with functional tests — it does not gate deploy on its own. A failing budget is a strong signal but not a blocker (it could indicate a test infrastructure issue rather than a regression). Teams should review the report and decide.
- Playwright is Chromium-only in CI to keep runner time under 5 minutes. Adding Firefox is a one-line change in `playwright.config.js`.
- E2E tests retry 2× in CI. The retry count is not hidden — a test that passes only after a retry is logged and reviewed.

---

## Coverage

Coverage is collected with `@vitest/coverage-v8` and reported as HTML + JSON to the `coverage/` directory.

```bash
npm run test:coverage
open coverage/index.html
```

**Coverage scope:** `src/lib/**/*.js` + `api/**/*.js`

**Current approach:** Coverage is measured and reported but not hard-gated in CI. The rationale: coverage percentage is a proxy metric. A 95%-covered file full of shallow assertions is less valuable than an 80%-covered file with meaningful scenarios. The AI coverage agent (`qa-agent-coverage.yml`) provides semantic gap analysis on every PR, which is a stronger signal than a line-count gate.

Revisit gating once the suite stabilises and the team aligns on meaningful thresholds per module.

---

## Local Development Workflow

```bash
# Fast feedback — unit tests in watch mode
npm test

# Component/page changes — targeted unit + E2E
npm run test:unit && npm run test:e2e

# Before opening a PR
npm run test:unit
npm run test:e2e
npm run test:coverage     # eyeball coverage delta
npm run build && npm run test:perf   # spot-check performance budget
```

---

## Conventions and Guidelines

### Test file location

| What | Where |
|---|---|
| Logic / service unit tests | Co-located with the source file (`*.test.js` next to `*.js`) |
| Component tests | Co-located with the Svelte component |
| API handler tests | Co-located with the handler (`api/`) |
| E2E specs | `tests/e2e/` |

### Naming

- Test files: `*.test.js` (unit/API), `*.spec.js` (E2E)
- Describe blocks: the thing under test — `describe('favoritesLogic', ...)`
- It blocks: behaviour in present tense — `it('removes a film from the list')`

### Mocking philosophy

- Mock at the **boundary** — external HTTP (MSW), localStorage (mockStorage), Svelte stores (resetStores). Never mock internal modules.
- Fixtures live in `tests/e2e/helpers.js` (E2E) and `src/mocks/` (unit/MSW). Keep them realistic — they should match the actual TMDB response shape.

### Do not write tests that

- Assert on CSS classes or implementation-specific element IDs
- Sleep with a fixed timeout to wait for async state
- Mock the module under test itself
- Pass only because retries masked a genuine failure

---

## Known Gaps and Roadmap

| Gap | Priority | Notes |
|---|---|---|
| Visual regression testing | High | `test:visual` script wired but `visual.spec.js` not yet implemented. Playwright screenshot comparison is the planned approach. |
| Cross-browser E2E | Medium | Firefox + Safari projects commented out of `playwright.config.js`. One-line enable. |
| Mobile / responsive E2E | Medium | PWA target with no device-emulation tests. Add `devices['iPhone 14']` project. |
| Coverage gating in CI | Low | Infrastructure ready; decision pending on per-module thresholds. |
| API contract validation | Low | No formal schema pinning against TMDB API versions. |

---

## Appendix: Running the Full Suite

```bash
# Install dependencies (first time)
npm ci
npx playwright install --with-deps chromium

# Full suite
npm run test:unit
npm run test:e2e
npm run test:coverage

# Performance budget (requires a clean build)
npm run build
npm run test:perf
```

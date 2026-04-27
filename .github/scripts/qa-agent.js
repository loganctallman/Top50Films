#!/usr/bin/env node
/**
 * QA Agent — called from GitHub Actions workflows.
 *
 * Usage:
 *   node .github/scripts/qa-agent.js failures   # analyze CI failure logs
 *   node .github/scripts/qa-agent.js coverage   # review PR for coverage gaps
 *
 * Required environment variables (set by the calling workflow):
 *   GITHUB_TOKEN      GitHub Actions token
 *   ANTHROPIC_API_KEY Anthropic API key (stored as a repo secret)
 *   REPO              owner/repo  e.g. "poppapill/top50"
 *
 * Mode-specific variables:
 *   failures: RUN_ID, HEAD_BRANCH, HEAD_SHA
 *   coverage: PR_NUMBER
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Validate inputs
// ---------------------------------------------------------------------------

const mode = process.argv[2]

if (!mode || !['failures', 'coverage'].includes(mode)) {
  console.error('Usage: qa-agent.js <failures|coverage>')
  process.exit(1)
}

const { GITHUB_TOKEN, ANTHROPIC_API_KEY, REPO } = process.env

if (!GITHUB_TOKEN) { console.error('Missing GITHUB_TOKEN'); process.exit(1) }
if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1) }
if (!REPO) { console.error('Missing REPO'); process.exit(1) }

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

async function ghFetch(path, options = {}) {
  const url = path.startsWith('https://')
    ? path
    : `https://api.github.com/repos/${REPO}${path}`

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub API ${path} → ${res.status}: ${body.slice(0, 300)}`)
  }
  return res
}

async function ghJson(path) {
  return (await ghFetch(path)).json()
}

async function ghPost(path, body) {
  return ghFetch(path, { method: 'POST', body: JSON.stringify(body) })
}

// ---------------------------------------------------------------------------
// Anthropic API
// ---------------------------------------------------------------------------

async function callClaude(system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }]
    })
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic API → ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  return data.content[0].text
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Keep only the last `maxChars` characters to respect context limits. */
function tail(str, maxChars = 20_000) {
  if (str.length <= maxChars) return str
  return `…[truncated — showing last ${maxChars} chars]\n` + str.slice(-maxChars)
}

/**
 * Reads all *.test.js and *.spec.js files from the standard test directories,
 * returning a map of { relativePath → content }.
 */
function collectTestFiles() {
  const roots = ['tests/e2e', 'src/lib', 'api']
  const result = {}

  for (const root of roots) {
    if (!existsSync(root)) continue
    collectRecursive(root, root, result)
  }

  return result
}

function collectRecursive(baseDir, currentDir, result) {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = join(currentDir, entry.name)
    if (entry.isDirectory()) {
      collectRecursive(baseDir, fullPath, result)
    } else if (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js')) {
      result[fullPath] = tail(readFileSync(fullPath, 'utf8'), 4_000)
    }
  }
}

/**
 * Returns entries from testFiles whose names overlap with any changed source file.
 * Falls back to all test files if nothing matches (e.g. infrastructure-only PRs).
 */
function filterRelevantTestFiles(testFiles, changedFilenames) {
  const changedStems = changedFilenames.map(f =>
    f.split('/').pop().replace(/\.(svelte|js|ts)$/, '').toLowerCase()
  )

  const relevant = {}
  for (const [path, content] of Object.entries(testFiles)) {
    const testStem = path.split('/').pop().replace(/\.(spec|test)\.(js|ts)$/, '').toLowerCase()
    const isRelevant = changedStems.some(stem =>
      testStem.includes(stem) || stem.includes(testStem)
    )
    if (isRelevant) relevant[path] = content
  }

  return Object.keys(relevant).length > 0 ? relevant : testFiles
}

// ---------------------------------------------------------------------------
// Mode: failures — analyze CI failure logs and open a GitHub issue
// ---------------------------------------------------------------------------

async function runFailureAnalysis() {
  const { RUN_ID, HEAD_BRANCH, HEAD_SHA } = process.env

  if (!RUN_ID) { console.error('Missing RUN_ID'); process.exit(1) }

  console.log(`Analyzing failed run ${RUN_ID} on ${HEAD_BRANCH}…`)

  // 1. Fetch all jobs for this run and keep only the ones that failed
  const { jobs } = await ghJson(`/actions/runs/${RUN_ID}/jobs`)
  const failed = jobs.filter(j => j.conclusion === 'failure')

  if (failed.length === 0) {
    console.log('No failed jobs found — nothing to report.')
    return
  }

  // 2. Fetch logs for each failed job (logs are plain text, can be large)
  const logSections = await Promise.all(failed.map(async job => {
    try {
      // GitHub redirects to a signed S3 URL; follow the redirect
      const logRes = await ghFetch(`/actions/jobs/${job.id}/logs`)
      const rawLog = await logRes.text()
      return `### Job: \`${job.name}\`\n\`\`\`\n${tail(rawLog, 18_000)}\n\`\`\``
    } catch (e) {
      return `### Job: \`${job.name}\`\n> Could not fetch logs: ${e.message}`
    }
  }))

  // 3. Gather test file context — only files whose names mention a failed job
  const allTestFiles = collectTestFiles()
  const failedJobNames = failed.map(j => j.name.toLowerCase())
  const relevantForFailures = filterRelevantTestFiles(allTestFiles, failedJobNames.map(n => `${n}.js`))
  const testContext = Object.entries(relevantForFailures)
    .map(([path, content]) => `#### ${path}\n\`\`\`js\n${content}\n\`\`\``)
    .join('\n\n')

  const shortSha = (HEAD_SHA || '').slice(0, 7)

  // 4. Call Claude
  const system = `\
You are a senior QA engineer. You review automated test failures in a CI pipeline \
and produce clear, actionable reports for the development team.

Your responsibilities:
- Identify the root cause of each failure (app regression vs. test code issue vs. environment/timing issue)
- Flag tests that show signs of flakiness: reliance on animation timing, fragile CSS selectors, \
  race conditions, hard-coded waits, or behaviour that differs between local and CI environments
- For each failure, state clearly: what failed, why it likely failed, and what kind of change is needed \
  (test-side fix or app-side fix) — describe the fix in plain English, do NOT write code
- Use the test file context to identify which specific test and file is affected

You must NOT:
- Write code or test implementations
- Suggest weakening assertions to hide real regressions
- Mark a genuine app regression as flaky without evidence

Format your response as GitHub-flavoured markdown.`

  const user = `\
# CI Failure Report — ${REPO}

**Run:** [#${RUN_ID}](https://github.com/${REPO}/actions/runs/${RUN_ID})
**Branch:** \`${HEAD_BRANCH}\`
**Commit:** \`${shortSha}\`
**Failed jobs:** ${failed.map(j => `\`${j.name}\``).join(', ')}

---

## Failed Job Logs

${logSections.join('\n\n')}

---

## Test Suite (for context)

${testContext}

---

Please produce a QA failure report with these sections:
1. **Summary** (2–3 sentences)
2. **Failure breakdown** — one entry per failing test or job, with root cause and classification (app regression | flaky | test code issue | environment issue)
3. **Flaky test candidates** — list any tests that look timing- or environment-sensitive
4. **Recommended actions** — plain-English description of what needs to change and where; no code
5. **Coverage note** — if these failures reveal an untested scenario, call it out`

  console.log('Calling Claude for analysis…')
  const report = await callClaude(system, user)

  // 5. Open a GitHub issue with the report
  const issueBody = `\
## 🤖 QA Agent — CI Failure Analysis

| | |
|---|---|
| **Run** | [#${RUN_ID}](https://github.com/${REPO}/actions/runs/${RUN_ID}) |
| **Branch** | \`${HEAD_BRANCH}\` |
| **Commit** | \`${shortSha}\` |
| **Failed jobs** | ${failed.map(j => `\`${j.name}\``).join(', ')} |

---

${report}

---
*Generated automatically by the QA Agent. Requires human review before any action is taken. No code was changed.*`

  await ghPost('/issues', {
    title: `[QA Agent] CI failure — \`${HEAD_BRANCH}\` @ ${shortSha}`,
    body: issueBody,
    labels: ['qa-failure']
  })

  console.log('Issue created successfully.')
}

// ---------------------------------------------------------------------------
// Mode: coverage — review a PR diff for test coverage gaps
// ---------------------------------------------------------------------------

async function runCoverageReview() {
  const { PR_NUMBER } = process.env

  if (!PR_NUMBER) { console.error('Missing PR_NUMBER'); process.exit(1) }

  console.log(`Reviewing coverage for PR #${PR_NUMBER}…`)

  // 1. PR metadata
  const pr = await ghJson(`/pulls/${PR_NUMBER}`)

  // 2. Changed files with diffs
  const allFiles = await ghJson(`/pulls/${PR_NUMBER}/files`)
  const relevant = allFiles.filter(f =>
    !f.filename.startsWith('node_modules/') &&
    !f.filename.startsWith('.github/') &&
    (
      f.filename.endsWith('.svelte') ||
      f.filename.endsWith('.js') ||
      f.filename.endsWith('.ts')
    )
  )

  if (relevant.length === 0) {
    console.log('No relevant source files changed — skipping coverage review.')
    return
  }

  // 3. Build a readable diff summary
  const diffSummary = relevant.map(f => {
    const patch = f.patch ? tail(f.patch, 3_000) : '(binary or no diff available)'
    return `### ${f.status.toUpperCase()}: \`${f.filename}\`\n\`\`\`diff\n${patch}\n\`\`\``
  }).join('\n\n')

  // 4. Existing test files — full content only for files relevant to the diff
  const testFiles = collectTestFiles()
  const testList = Object.keys(testFiles).map(f => `- \`${f}\``).join('\n')
  const relevantTestFiles = filterRelevantTestFiles(testFiles, relevant.map(f => f.filename))
  const testContext = Object.entries(relevantTestFiles)
    .map(([path, content]) => `#### ${path}\n\`\`\`js\n${content}\n\`\`\``)
    .join('\n\n')

  // 5. Call Claude
  const system = `\
You are a senior QA engineer reviewing a pull request for test coverage gaps.

The project is a Svelte 4 PWA — a film tracking app where users maintain a favourites list \
and see streaming availability. The test suite has two layers:
- Unit tests (Vitest): logic, stores, API handlers
- E2E tests (Playwright/Chromium): full user flows, accessibility (axe-core), and cache behaviour

Your job:
- Review what the diff adds, changes, or removes
- Identify code paths, edge cases, or user flows that have no corresponding test
- Rate each gap: **CRITICAL** (untested logic that can silently break), **MODERATE** (missing edge case), **LOW** (minor scenario)
- Be specific: name which test file the coverage should go in and describe the scenario in plain English
- If the change is already well-covered, say so explicitly — avoid false positives
- Do NOT write test code. Describe scenarios, not implementations.

Be concise. Skip trivial style changes. Focus on behavioural and logical gaps.
Format your response as GitHub-flavoured markdown.`

  const user = `\
# PR Coverage Review — ${REPO}

**PR #${PR_NUMBER}:** ${pr.title}
**Author:** @${pr.user.login}
**Branch:** \`${pr.head.ref}\` → \`${pr.base.ref}\`
**Changed files:** ${relevant.length} (${relevant.map(f => `\`${f.filename}\``).join(', ')})

---

## Diff

${diffSummary}

---

## Existing Test Files

${testList}

---

## Test File Contents (for context)

${testContext}

---

Please produce a coverage review with:
1. **Overall assessment** — is the change well-tested or not? (1–2 sentences)
2. **Coverage gaps** — specific missing scenarios with severity rating and which test file they belong in
3. **Removed code** — note if any deleted code had corresponding tests that are now orphaned or misleading
4. **Verdict** — GOOD COVERAGE | GAPS FOUND | NEEDS TESTS BEFORE MERGE`

  console.log('Calling Claude for coverage review…')
  const report = await callClaude(system, user)

  // 6. Post as a PR comment
  // Collapse the detailed section so the comment is scannable at a glance
  const commentBody = `\
## 🤖 QA Agent — Coverage Review

${report}

<details>
<summary>About this report</summary>

This is an automated analysis of test coverage gaps in the diff. It is informational only — \
no code was changed. Use human judgment before acting on any suggestion.

Triggered by: PR #${PR_NUMBER} · [QA Agent workflow](https://github.com/${REPO}/actions/workflows/qa-agent-coverage.yml)

</details>`

  // Check for an existing QA Agent comment on this PR and update it if found
  // (avoids a new comment on every push to the branch)
  const comments = await ghJson(`/issues/${PR_NUMBER}/comments`)
  const existing = comments.find(c =>
    c.user.type === 'Bot' && c.body.startsWith('## 🤖 QA Agent — Coverage Review')
  )

  if (existing) {
    await ghFetch(`/issues/comments/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: commentBody })
    })
    console.log(`Updated existing coverage comment (id ${existing.id}).`)
  } else {
    await ghPost(`/issues/${PR_NUMBER}/comments`, { body: commentBody })
    console.log('Coverage comment posted.')
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

try {
  if (mode === 'failures') {
    await runFailureAnalysis()
  } else {
    await runCoverageReview()
  }
} catch (err) {
  console.error(`QA Agent (${mode}) error:`, err.message)
  process.exit(1)
}

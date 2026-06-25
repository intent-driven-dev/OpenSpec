## Why

OpenSpec specs must currently be written in one fixed dialect of Markdown — the
delta engine recognizes only `### Requirement:`, `#### Scenario:`, and
`## ADDED/MODIFIED/REMOVED/RENAMED Requirements` headers, and only files named
`spec.md`. Teams that prefer another spec language (e.g. Gherkin `.feature`) cannot
use OpenSpec without abandoning their format, even though the delta semantics they
need (add/remove/modify/rename a named requirement) are format-independent.

## What Changes

- A project can author specs in **any text format that supports comments** (e.g.
  Gherkin `.feature`) and still get the full OpenSpec delta workflow — validate,
  apply/sync, archive — as long as the format's markers are declared in its schema.
- The spec **format markers become data, declared in the resolved schema**, instead
  of being hardcoded in the parsers: a file extension, a requirement-identity
  pattern, an optional scenario pattern, and delta-operation patterns (section-style
  for Markdown, or inline comment-marker style for other formats).
- The delta parser, the spec discovery (no longer fixed to `spec.md`), and the
  block-splicing merge read these markers from the schema.
- Markdown remains the **default** format: the `format` block is optional and its
  absence resolves to today's Markdown markers, so existing projects *and* existing
  user-forked schemas behave identically with **no migration**. **Not breaking.**
- A worked "bring your own format" example (Gherkin `.feature`) is documented and
  shipped as an executable test fixture.

## Capabilities

### New Capabilities
- `spec-format-markers`: A schema can declare the markers OpenSpec uses to recognize
  a spec's file extension, requirement identity, scenarios, and delta operations, so
  parsing, discovery, and delta-merge work for any comment-bearing text format.

### Modified Capabilities
- `openspec-conventions`: The structured spec format (requirement/scenario/delta
  markers) is now defined by the resolved schema rather than fixed to Markdown
  headers, with Markdown as the default dialect.

## Impact

- Affected specs: new `spec-format-markers`; modified `openspec-conventions`.
- Affected code: `src/core/artifact-graph/types.ts` and `schema.ts` (schema `format`
  block + validation); `schemas/spec-driven/schema.yaml` (default Markdown markers);
  `src/core/parsers/requirement-blocks.ts`, `spec-structure.ts`,
  `markdown-parser.ts`, `change-parser.ts` (marker-driven parsing); `src/core/
  specs-apply.ts` and `archive.ts` (extension-driven discovery, replacing ~18
  hardcoded `spec.md` sites).
- No new dependencies; no execution of user-supplied code (markers are declarative
  patterns).

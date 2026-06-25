## Context

OpenSpec's delta workflow is structurally coupled to one Markdown dialect. The
parsers (`src/core/parsers/requirement-blocks.ts`, `spec-structure.ts`,
`markdown-parser.ts`, `change-parser.ts`) hardcode `### Requirement:`,
`#### Scenario:`, and `## ADDED/MODIFIED/REMOVED/RENAMED Requirements`, and the spec
filename `spec.md` is hardcoded in ~18 discovery/merge sites
(`specs-apply.ts`, `archive.ts`). The canonical data model is already
format-neutral (`Spec { name, overview, requirements[] }`,
`Requirement { text, scenarios[] }`, with a `metadata.format` field at
`src/core/schemas/spec.schema.ts:12`).

OpenSpec already resolves a per-change **schema** (`schemas/spec-driven/schema.yaml`,
selected via `.openspec.yaml` metadata, default `spec-driven`). That schema already
owns the spec extension (`generates: "specs/**/*.md"`), `template`, and authoring
`instruction`. This design extends the schema to also own the *markers*, making the
schema the single source of truth for "what a spec looks like."

## Goals / Non-Goals

**Goals:**
- Let a project author specs in any comment-bearing text format while keeping the
  full delta workflow (validate, apply/sync, archive).
- Make spec format markers declarative data in the schema, not hardcoded regexes.
- Zero behavior change and zero migration for existing Markdown projects.

**Non-Goals:**
- Executing user-supplied parser code or plugins. Markers are declarative patterns
  only.
- Auto-detecting a format from file contents. The schema declares the format.
- Cross-format delta merge (a change's delta is authored in the same format as the
  main spec it targets).
- Deep grammar parsing of the requirement body. Content between markers is treated
  as an opaque payload that is spliced by name.

## Decisions

### 1. Markers live in a schema `format:` block
Add an optional `format` object to `SchemaYamlSchema`
(`src/core/artifact-graph/types.ts`), validated in `schema.ts`:

```yaml
format:
  extension: ".md"                                   # spec file extension
  requirement: '^###\s+Requirement:\s*(?<name>.+)$'  # identity / merge key
  scenario:    '^####\s+Scenario:'                   # optional rigor check
  delta:                                             # one of two dialects:
    # section dialect (Markdown):
    added:    '^##\s+ADDED Requirements'
    modified: '^##\s+MODIFIED Requirements'
    removed:  '^##\s+REMOVED Requirements'
    renamed:  '^##\s+RENAMED Requirements'
    # OR inline-marker dialect (other formats):
    marker:   '@openspec:\s*(?<op>ADDED|MODIFIED|REMOVED|RENAMED)'
    rename:   '@openspec:\s*RENAMED\s+from="(?<from>[^"]+)"\s+to="(?<to>[^"]+)"'
```

The built-in `spec-driven` schema ships the Markdown values above, so the default is
byte-identical to today.

*Why over alternatives:* A new top-level config/registry would duplicate machinery
that the schema already provides (per-change resolution, project/user/builtin
precedence, packaging with templates). Reusing the schema keeps one extension point.

### 2. Two delta dialects, selected by which keys are present
- **Section dialect** (`added`/`modified`/`removed`/`renamed`): operation is the
  section a block sits under — today's Markdown behavior.
- **Inline-marker dialect** (`marker`): operation is a comment marker immediately
  preceding each requirement block; the block extends to the next marker.

The engine never parses "comments." It scans each line for the sentinel via the
configured pattern; surrounding comment punctuation (`#`, `//`, `<!-- -->`, `;`) is
ignored text. This is what makes it comment-syntax agnostic with no per-format code.

### 3. Parsers take marker config as input
`parseDeltaSpec` and `extractRequirementsSection` change from using module-level
constant regexes to accepting a resolved `FormatMarkers` argument. The block-splicing
merge in `buildUpdatedSpec` (`specs-apply.ts`) is already block-oriented; it consumes
blocks from the marker-driven parser unchanged in shape. `findMainSpecStructureIssues`
(`spec-structure.ts`) derives its checks and messages from the markers.

### 4. Discovery is extension-driven
The ~18 `spec.md` sites resolve the spec filename as `spec` + `format.extension` from
the change's resolved schema. One `spec.<ext>` per capability directory; the extension
selects the parser. Mixed-format projects fall out naturally (per-capability schema).
File paths continue to use `path.join`.

### 5. Scenario rigor is opt-in per format
If `format.scenario` is present, the "every requirement has ≥1 scenario" check applies
as today. If omitted, the format runs in opaque-payload mode and the check is skipped
(a requirement is valid when it is named and has a non-empty body).

## Risks / Trade-offs

- [Regex authored in schema is malformed] → Validate `format` patterns at schema-load
  time (compile each regex; require the expected named groups such as `name`/`op`);
  fail with a clear message naming the offending key.
- [Inline marker token collides with literal spec text] → Require the sentinel to be a
  distinctive token (e.g. `@openspec:`); document that it must appear only in delta
  annotations. Section dialect is unaffected.
- [Hidden Markdown assumptions outside the listed sites] → Audit for `spec.md` and the
  three header regexes repo-wide; route every match through the resolved markers.
  Guard with golden tests asserting existing Markdown fixtures parse/merge/archive
  byte-identically.
- [Validation/error messages were Markdown-worded] → Derive wording from the resolved
  format (extension, marker examples) instead of hardcoded `## ADDED Requirements`.

## Migration Plan

No migration. Existing projects use the default `spec-driven` schema whose `format`
block reproduces current behavior. Adopting a new format is purely additive: author a
schema with a `format` block and select it via `.openspec.yaml`. Rollback is removing
the `format` block / custom schema.

## Open Questions

- Should the inline-marker dialect also be offered as an alternative for Markdown
  (e.g. `<!-- @openspec: ADDED -->`), or stay section-only for Markdown? (Leaning:
  section-only for Markdown to preserve the current contract; revisit later.)

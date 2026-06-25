# Spec Format Flexibility

OpenSpec supports specs written in any text format that uses consistent markers to
identify requirements and delta operations. The Markdown format (with `### Requirement:`,
`#### Scenario:`, and `## ADDED/MODIFIED/REMOVED/RENAMED Requirements` headers) is the
**default** and is automatically used when no `format` block is declared.

## The `format` block in a schema

A schema can declare a `format` block that tells OpenSpec how to recognize a spec's
structure. When the block is absent, OpenSpec falls back to the built-in Markdown defaults
— so existing projects and user-forked schemas require **no changes**.

```yaml
# openspec/schemas/<name>/schema.yaml
format:
  extension: ".md"                                    # file extension for spec files
  requirement: '^###\s+Requirement:\s*(?<name>.+)$'  # regex; must capture named group 'name'
  scenario:    '^####\s+Scenario:'                    # optional; when absent, scenario check is skipped
  delta:                                              # one of two dialects (see below)
    # Section dialect — operation determined by which ## section a block is under:
    added:    '^##\s+ADDED Requirements'
    modified: '^##\s+MODIFIED Requirements'
    removed:  '^##\s+REMOVED Requirements'
    renamed:  '^##\s+RENAMED Requirements'
```

### `format` fields

| Field | Required | Description |
|---|---|---|
| `extension` | yes | File extension for spec files, e.g. `.md` or `.feature` |
| `requirement` | yes | Regex that matches a requirement header. Must have named capture `(?<name>...)`. |
| `scenario` | no | Regex that matches a scenario header. When absent, the "≥1 scenario" check is skipped. |
| `delta` | yes | Delta dialect declaration (section-style or inline-marker). |

### Delta dialects

**Section dialect** (default for Markdown):
Operations are determined by which `##` section a requirement block appears under.

```yaml
delta:
  added:    '^##\s+ADDED Requirements'
  modified: '^##\s+MODIFIED Requirements'
  removed:  '^##\s+REMOVED Requirements'
  renamed:  '^##\s+RENAMED Requirements'
```

**Inline-marker dialect** (for non-Markdown formats):
Operations are determined by a marker line immediately preceding each requirement block.

```yaml
delta:
  marker: '@openspec:\s*(?<op>ADDED|MODIFIED|REMOVED|RENAMED)'  # must capture named group 'op'
  rename: '@openspec:\s*RENAMED\s+from="(?<from>[^"]+)"\s+to="(?<to>[^"]+)"'  # captures 'from' and 'to'
```

The engine scans each line for the sentinel pattern. Any surrounding comment punctuation
(`#`, `//`, `<!-- -->`, `;`) is ignored — the regex only needs to match the marker itself.

## Validation at schema-load time

OpenSpec validates the `format` block when the schema is loaded:

- Every pattern must be a valid regular expression; invalid patterns fail immediately.
- The `requirement` pattern must contain `(?<name>...)`.
- The inline `marker` pattern must contain `(?<op>...)`.
- The inline `rename` pattern must contain `(?<from>...)` and `(?<to>...)`.

Errors name the offending field, e.g. `format.requirement: pattern must include a named capture (?<name>...)`.

## Scenario rigor

When `format.scenario` is declared, OpenSpec enforces the rule that every requirement
must include at least one scenario (as it does today for Markdown). When `format.scenario`
is omitted, a requirement is valid when it has a name and a non-empty body.

## Backward compatibility

- The `format` block is **optional**. Schemas without it behave exactly as before.
- The built-in `spec-driven` schema explicitly declares the Markdown values (as living
  documentation), but the behavior is identical whether or not the block is present.
- User-forked schemas created with `openspec schema fork` will not have a `format` block
  and will continue to use Markdown defaults automatically.

---

See [Bring Your Own Format walkthrough](./spec-format-byo.md) for a step-by-step example
using Gherkin `.feature` files.

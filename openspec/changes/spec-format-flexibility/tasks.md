## 1. Schema format definition

- [ ] 1.1 Add an **optional** `format` block to `SchemaYamlSchema` in `src/core/artifact-graph/types.ts` (extension, requirement, scenario, and delta markers; section-style keys OR inline `marker`/`rename`). When absent, resolve to the built-in Markdown defaults so existing and user-forked schemas are unaffected.
- [ ] 1.2 Validate the `format` block in `src/core/artifact-graph/schema.ts`: compile each marker pattern and require expected named captures (`name` on requirement, `op` on inline marker, `from`/`to` on rename); fail with a message naming the offending field.
- [ ] 1.3 Add the default Markdown `format` block to `schemas/spec-driven/schema.yaml` reproducing today's markers and `.md` extension.
- [ ] 1.4 Add a `resolveFormatMarkers(schema)` helper that returns the effective `FormatMarkers` (declared format, else Markdown defaults).

## 2. Marker-driven parsing

- [ ] 2.1 Refactor `parseDeltaSpec` and `extractRequirementsSection` in `src/core/parsers/requirement-blocks.ts` to take `FormatMarkers` instead of module-level Markdown regexes; support both the section dialect and the inline-marker dialect.
- [ ] 2.2 Make `findMainSpecStructureIssues` in `src/core/parsers/spec-structure.ts` derive its checks and error wording from `FormatMarkers`.
- [ ] 2.3 Drive requirement/scenario/section detection in `src/core/parsers/markdown-parser.ts` and `change-parser.ts` from `FormatMarkers`; gate the "≥1 scenario" rule on the presence of a scenario marker.

## 3. Extension-driven discovery and merge

- [ ] 3.1 Replace the ~18 hardcoded `spec.md` sites (`src/core/specs-apply.ts`, `src/core/archive.ts`, and any others found by audit) with the resolved `spec` + `format.extension`, composed via `path.join`.
- [ ] 3.2 Thread `FormatMarkers` from the resolved schema (via `resolveSchema`/`loadChangeContext` in `instruction-loader.ts`) into discovery, parsing, and `buildUpdatedSpec`.
- [ ] 3.3 Audit the repo for remaining `spec.md` / `### Requirement:` / `#### Scenario:` / `## ADDED Requirements` assumptions and route them through `FormatMarkers`.

## 4. Tests

- [ ] 4.1 Backward-compat characterization: parse the repo's own spec corpus (`openspec/specs/**`, ~37 capabilities) and snapshot the requirement/scenario set; assert unchanged after the refactor. Plus a golden test that a Markdown delta apply/archive is byte-identical to pre-change output.
- [ ] 4.5 Assert a schema with no `format` block resolves to the Markdown markers (covers user-forked schemas).
- [ ] 4.2 Parametrized parser tests over two formats (Markdown section-style + a comment-marker fixture) asserting equal `DeltaPlan` output for equivalent ADDED/MODIFIED/REMOVED/RENAMED inputs.
- [ ] 4.3 Schema validation tests: malformed marker pattern and missing required capture both fail with a field-naming error.
- [ ] 4.4 E2E: a fixture project with a non-Markdown `format` schema authors a delta spec, then `openspec validate`, apply/sync, and archive round-trip and merge by name; `openspec list --json` and `change show --json --deltas-only` report correct deltas.

## 5. Docs & example

- [ ] 5.1 Document the schema `format` block (fields, both delta dialects, scenario-rigor behavior, and that `format` is optional → Markdown default).
- [ ] 5.2 Add a worked "bring your own format" walkthrough: `openspec schema fork spec-driven gherkin`, the Gherkin `format` block (identity from native `Rule:`, op from `# @openspec: <OP>`), and a sample `spec.feature` delta.
- [ ] 5.3 Ship the Gherkin schema + `.feature` delta as a `test/` E2E fixture so the example is executable and stays correct.

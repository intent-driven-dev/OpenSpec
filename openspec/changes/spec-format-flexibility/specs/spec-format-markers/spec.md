## ADDED Requirements

### Requirement: Schema declares spec format markers

A schema SHALL be able to declare a `format` definition that tells OpenSpec how to
recognize a spec's file extension, requirement identity, scenarios, and delta
operations, so that parsing, discovery, and delta-merge work for the declared format
without changing OpenSpec's code.

#### Scenario: Format declared in schema is used for the change
- **WHEN** a change resolves to a schema whose `format` declares an extension and
  requirement/scenario/delta marker patterns
- **THEN** OpenSpec uses those markers to discover, parse, and merge that change's
  specs

#### Scenario: Format markers are declarative only
- **WHEN** a schema declares its `format` markers
- **THEN** the markers are pattern data evaluated by OpenSpec
- **AND** no user-supplied code is executed to parse specs

### Requirement: Markdown is the default spec format

OpenSpec SHALL treat Markdown as the default spec format so that projects which do not
declare a `format` behave exactly as before, with no migration required. A schema's
`format` declaration SHALL be optional, and its absence SHALL select the Markdown
markers.

#### Scenario: Project without a declared format
- **WHEN** a change resolves to the built-in default schema and no custom `format`
  is declared
- **THEN** OpenSpec recognizes `### Requirement:`, `#### Scenario:`, and
  `## ADDED/MODIFIED/REMOVED/RENAMED Requirements` in `spec.md` files exactly as it
  did before this change

#### Scenario: Any schema that omits a format falls back to Markdown
- **WHEN** a change resolves to a schema (including a user-forked schema) that does
  not declare a `format`
- **THEN** OpenSpec uses the Markdown markers for that change's specs

#### Scenario: Existing Markdown specs are unaffected
- **WHEN** existing Markdown specs are validated, applied, or archived after this
  change
- **THEN** the parsed requirements, deltas, and merged output are identical to the
  pre-change behavior

### Requirement: Spec files are discovered by the declared extension

OpenSpec SHALL discover a capability's spec file using the extension declared by the
resolved schema's `format`, rather than assuming a `.md` extension.

#### Scenario: Non-Markdown extension is discovered
- **WHEN** a schema's `format` declares the extension `.feature`
- **AND** a capability directory contains `spec.feature`
- **THEN** OpenSpec discovers and processes that file as the capability's spec

#### Scenario: Capability spec path is built cross-platform
- **WHEN** OpenSpec builds the path to a capability's spec file
- **THEN** the path is composed using platform-safe path joining on macOS, Linux,
  and Windows

### Requirement: Delta operations are recognized via declared markers

OpenSpec SHALL recognize ADDED, REMOVED, MODIFIED, and RENAMED delta operations using
the markers declared by the resolved schema's `format`, supporting both a
section-style dialect and an inline comment-marker dialect.

#### Scenario: Section-style deltas (Markdown)
- **WHEN** a delta spec groups requirements under `## ADDED Requirements`,
  `## MODIFIED Requirements`, `## REMOVED Requirements`, or `## RENAMED Requirements`
- **THEN** OpenSpec assigns each requirement block the operation of its section

#### Scenario: Inline comment-marker deltas (other formats)
- **WHEN** a delta spec annotates each requirement with an inline marker such as
  `@openspec: ADDED` placed in the format's native comment syntax
- **THEN** OpenSpec assigns that requirement the annotated operation
- **AND** the surrounding comment punctuation does not affect recognition

#### Scenario: Rename carries old and new names
- **WHEN** a renamed requirement is annotated with both its previous and new names via
  the declared rename marker
- **THEN** OpenSpec records the rename from the old name to the new name

#### Scenario: Requirement identity drives the merge
- **WHEN** a delta block is applied to a main spec
- **THEN** OpenSpec matches it to the target requirement by the name captured from the
  declared requirement marker

### Requirement: Scenario rigor follows the declared format

OpenSpec SHALL enforce the "every requirement has at least one scenario" rule only
when the resolved schema's `format` declares a scenario marker; otherwise a requirement
is valid when it has a name and a non-empty body.

#### Scenario: Scenario marker declared
- **WHEN** a schema's `format` declares a scenario marker
- **AND** a requirement has no scenario
- **THEN** validation reports the missing-scenario problem as it does for Markdown

#### Scenario: Scenario marker omitted
- **WHEN** a schema's `format` omits a scenario marker
- **AND** a requirement has a name and a non-empty body
- **THEN** validation accepts the requirement without requiring a scenario

### Requirement: Invalid format declarations are reported clearly

OpenSpec SHALL validate a schema's `format` declaration when the schema is loaded and
report a clear error that names the offending field when a marker pattern is malformed
or missing a required capture.

#### Scenario: Malformed marker pattern
- **WHEN** a schema's `format` declares a marker pattern that cannot be compiled
- **THEN** loading the schema fails with an error identifying the offending `format`
  field

#### Scenario: Requirement marker missing its name capture
- **WHEN** a schema's `format` requirement marker does not capture a requirement name
- **THEN** loading the schema fails with an error explaining that the requirement
  marker must capture a name

## MODIFIED Requirements

### Requirement: Structured conventions for specs and changes

OpenSpec conventions SHALL mandate a structured spec format with clear requirement
and scenario sections so tooling can parse consistently. The concrete markers that
express this structure SHALL be defined by the resolved schema's format, with Markdown
as the default format so existing projects are unaffected.

#### Scenario: Following the default Markdown spec format

- **WHEN** writing or updating OpenSpec specifications under the default format
- **THEN** authors SHALL use `### Requirement: ...` followed by at least one
  `#### Scenario: ...` section

#### Scenario: Following a schema-declared spec format

- **WHEN** a project's resolved schema declares a non-default spec format
- **THEN** authors SHALL express requirements and scenarios using that schema's
  declared markers
- **AND** OpenSpec tooling parses the specs consistently using those markers

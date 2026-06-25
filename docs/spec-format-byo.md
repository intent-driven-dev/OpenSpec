# Bring Your Own Format: Gherkin Example

This walkthrough shows how to use OpenSpec with Gherkin `.feature` files instead of Markdown.
The same delta workflow (validate, apply/sync, archive) works with any format whose markers you declare.

## 1. Fork the built-in schema

```sh
openspec schema fork spec-driven gherkin
```

This creates `openspec/schemas/gherkin/schema.yaml` in your project.

## 2. Add the `format` block

Open `openspec/schemas/gherkin/schema.yaml` and add:

```yaml
format:
  extension: ".feature"
  requirement: '^\s*Rule:\s*(?<name>.+)$'         # identity from native Gherkin Rule
  scenario:    '^\s*Scenario:'
  delta:
    marker:  '@openspec:\s*(?<op>ADDED|MODIFIED|REMOVED|RENAMED)'
    rename:  '@openspec:\s*RENAMED\s+from="(?<from>[^"]+)"\s+to="(?<to>[^"]+)"'
```

Also update the `specs` artifact to use the `.feature` extension:

```yaml
artifacts:
  - id: specs
    generates: "specs/**/*.feature"
    ...
```

## 3. Select the schema for your change

In your change directory, create or update `.openspec.yaml`:

```yaml
# openspec/changes/add-email-verify/.openspec.yaml
schema: gherkin
```

## 4. Write your main spec

A main spec (`openspec/specs/user-auth/spec.feature`):

```gherkin
Feature: User authentication

  Rule: Password must meet complexity requirements
    User passwords must contain at least 8 characters.

    Scenario: Short password rejected
      Given a user with password "abc"
      When they try to register
      Then they see a validation error

  Rule: Session expires after inactivity
    Sessions are invalidated after 30 minutes of inactivity.

    Scenario: Idle session expires
      Given a user idle for 30 minutes
      When they try to act
      Then they are redirected to login
```

## 5. Write a delta spec

A delta spec (`openspec/changes/add-email-verify/specs/user-auth/spec.feature`):

```gherkin
Feature: User authentication changes

  # @openspec: ADDED
  Rule: Email must be verified before login
    Unverified accounts cannot log in to the system.

    Scenario: Unverified user is blocked
      Given an account with an unverified email address
      When the user attempts to log in
      Then access is denied

  # @openspec: REMOVED
  Rule: Session expires after inactivity

  # @openspec: RENAMED from="Password must meet complexity requirements" to="Password complexity is enforced"
```

### How it works

The engine reads each line of the delta spec:
- `# @openspec: ADDED` → sets the pending operation to ADDED
- `Rule: Email must be verified…` → starts an ADDED requirement block
- `# @openspec: REMOVED` → sets pending operation to REMOVED
- `Rule: Session expires…` → name of the removed requirement
- `# @openspec: RENAMED from="..." to="..."` → records a rename pair

The `#` is just the host language's comment syntax; the engine scans for `@openspec:` and ignores the surrounding characters.

## 6. Apply the delta

```sh
openspec sync add-email-verify    # applies specs, leaves change active
# or
openspec archive add-email-verify  # applies specs and archives the change
```

OpenSpec uses the `gherkin` schema (from `.openspec.yaml`) to discover `spec.feature` files
and parse them with the declared markers.

## 7. Verify

The updated main spec at `openspec/specs/user-auth/spec.feature` will contain:
- `Rule: Email must be verified before login` (ADDED)
- `Rule: Password complexity is enforced` (RENAMED from the old name)
- No `Rule: Session expires after inactivity` (REMOVED)

## Executable fixture

This walkthrough is backed by an executable fixture at
`test/fixtures/gherkin-format/`. The test `test/core/format-markers-fixture.test.ts`
verifies the full round-trip stays correct.

/**
 * 4.4 E2E: a fixture project with a non-Markdown format schema authors a delta
 * spec, then apply/sync merges by name.
 *
 * Tests the full round-trip: build main spec from scratch, author a delta in
 * inline-marker dialect, apply it, and verify the resulting spec is correct.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { findSpecUpdates, buildUpdatedSpec } from '../../src/core/specs-apply.js';
import {
  parseDeltaSpec,
  extractRequirementsSection,
} from '../../src/core/parsers/requirement-blocks.js';
import type { FormatMarkers } from '../../src/core/artifact-graph/format-markers.js';

// Gherkin-like format (inline comment-marker dialect)
const GHERKIN_FORMAT: FormatMarkers = {
  extension: '.feature',
  requirementRegex: /^\s*Rule:\s*(?<name>.+)$/,
  scenarioRegex: /^\s*Scenario:/,
  delta: {
    type: 'inline',
    markerRegex: /@openspec:\s*(?<op>ADDED|MODIFIED|REMOVED|RENAMED)/,
    renameRegex: /@openspec:\s*RENAMED\s+from="(?<from>[^"]+)"\s+to="(?<to>[^"]+)"/,
  },
};

// A simple non-Markdown main spec
const GHERKIN_MAIN_SPEC = `Feature: User authentication

  Rule: Password must meet complexity requirements
    Users must choose passwords that are at least 8 characters.
    Scenario: Short password is rejected
      Given a user with password "abc"
      When they try to register
      Then they see a validation error

  Rule: Session must expire after inactivity
    Sessions expire after 30 minutes of inactivity.
    Scenario: Session expires
      Given an idle session
      When 30 minutes pass
      Then the session is invalidated
`;

// A delta spec that adds one requirement and removes one
const GHERKIN_DELTA = `Feature: User authentication changes

  # @openspec: ADDED
  Rule: Email must be verified before login
    Unverified accounts cannot log in.
    Scenario: Unverified user blocked
      Given an account with unverified email
      When they try to log in
      Then access is denied

  # @openspec: REMOVED
  Rule: Session must expire after inactivity

  # @openspec: RENAMED from="Password must meet complexity requirements" to="Password complexity requirements"
`;

describe('4.4 E2E: inline-marker format apply round-trip', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `openspec-e2e-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('parseDeltaSpec correctly parses inline-marker delta', () => {
    const plan = parseDeltaSpec(GHERKIN_DELTA, GHERKIN_FORMAT);
    expect(plan.added).toHaveLength(1);
    expect(plan.added[0].name).toBe('Email must be verified before login');
    expect(plan.removed).toHaveLength(1);
    expect(plan.removed[0]).toBe('Session must expire after inactivity');
    expect(plan.renamed).toHaveLength(1);
    expect(plan.renamed[0].from).toBe('Password must meet complexity requirements');
    expect(plan.renamed[0].to).toBe('Password complexity requirements');
  });

  it('extractRequirementsSection parses inline-format main spec', () => {
    const parts = extractRequirementsSection(GHERKIN_MAIN_SPEC, GHERKIN_FORMAT);
    expect(parts.bodyBlocks).toHaveLength(2);
    expect(parts.bodyBlocks[0].name).toBe('Password must meet complexity requirements');
    expect(parts.bodyBlocks[1].name).toBe('Session must expire after inactivity');
  });

  it('buildUpdatedSpec applies delta to main spec (add + remove + rename)', async () => {
    // Set up file system
    const changeSpecsDir = path.join(tempDir, 'openspec', 'changes', 'test-change', 'specs', 'user-auth');
    const mainSpecsDir = path.join(tempDir, 'openspec', 'specs', 'user-auth');
    await fs.mkdir(changeSpecsDir, { recursive: true });
    await fs.mkdir(mainSpecsDir, { recursive: true });

    await fs.writeFile(path.join(changeSpecsDir, 'spec.feature'), GHERKIN_DELTA, 'utf-8');
    await fs.writeFile(path.join(mainSpecsDir, 'spec.feature'), GHERKIN_MAIN_SPEC, 'utf-8');

    const update = {
      source: path.join(changeSpecsDir, 'spec.feature'),
      target: path.join(mainSpecsDir, 'spec.feature'),
      exists: true,
    };

    const result = await buildUpdatedSpec(update, 'test-change', { markers: GHERKIN_FORMAT });

    expect(result.counts.added).toBe(1);
    expect(result.counts.removed).toBe(1);
    expect(result.counts.renamed).toBe(1);

    // Verify the rebuilt spec has the new requirement
    const parts = extractRequirementsSection(result.rebuilt, GHERKIN_FORMAT);
    const names = parts.bodyBlocks.map(b => b.name);

    // Added
    expect(names).toContain('Email must be verified before login');
    // Removed
    expect(names).not.toContain('Session must expire after inactivity');
    // Renamed
    expect(names).toContain('Password complexity requirements');
    expect(names).not.toContain('Password must meet complexity requirements');
  });

  it('findSpecUpdates discovers .feature files when extension is .feature', async () => {
    const changeDir = path.join(tempDir, 'openspec', 'changes', 'test-change');
    const mainSpecsDir = path.join(tempDir, 'openspec', 'specs');
    const specDir = path.join(changeDir, 'specs', 'user-auth');
    await fs.mkdir(specDir, { recursive: true });

    await fs.writeFile(path.join(specDir, 'spec.feature'), GHERKIN_DELTA, 'utf-8');

    const updates = await findSpecUpdates(changeDir, mainSpecsDir, GHERKIN_FORMAT);
    expect(updates).toHaveLength(1);
    expect(updates[0].source).toContain('spec.feature');
    expect(updates[0].target).toContain('spec.feature');
  });

  it('findSpecUpdates does NOT find .md files when extension is .feature', async () => {
    const changeDir = path.join(tempDir, 'openspec', 'changes', 'test-change');
    const mainSpecsDir = path.join(tempDir, 'openspec', 'specs');
    const specDir = path.join(changeDir, 'specs', 'user-auth');
    await fs.mkdir(specDir, { recursive: true });

    // Create a .md file in the change dir (wrong extension for this format)
    await fs.writeFile(path.join(specDir, 'spec.md'), '## ADDED Requirements\n### Requirement: Something\n', 'utf-8');

    const updates = await findSpecUpdates(changeDir, mainSpecsDir, GHERKIN_FORMAT);
    expect(updates).toHaveLength(0);
  });
});

describe('4.4 E2E: section-dialect format remains unchanged', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `openspec-section-e2e-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('applies a Markdown delta spec correctly (regression)', async () => {
    const mainSpec = `# My Spec

## Purpose
A test spec.

## Requirements

### Requirement: Original requirement
The system SHALL do the original thing.

#### Scenario: Original behavior
- **WHEN** condition
- **THEN** result
`;

    const delta = `## ADDED Requirements

### Requirement: New requirement
The system SHALL do a new thing.

#### Scenario: New behavior
- **WHEN** new condition
- **THEN** new result
`;

    const changeSpecsDir = path.join(tempDir, 'openspec', 'changes', 'test-change', 'specs', 'my-cap');
    const mainSpecsDir = path.join(tempDir, 'openspec', 'specs', 'my-cap');
    await fs.mkdir(changeSpecsDir, { recursive: true });
    await fs.mkdir(mainSpecsDir, { recursive: true });

    await fs.writeFile(path.join(changeSpecsDir, 'spec.md'), delta, 'utf-8');
    await fs.writeFile(path.join(mainSpecsDir, 'spec.md'), mainSpec, 'utf-8');

    const update = {
      source: path.join(changeSpecsDir, 'spec.md'),
      target: path.join(mainSpecsDir, 'spec.md'),
      exists: true,
    };

    // No explicit markers = uses Markdown defaults
    const result = await buildUpdatedSpec(update, 'test-change');
    expect(result.counts.added).toBe(1);

    const parts = extractRequirementsSection(result.rebuilt);
    const names = parts.bodyBlocks.map(b => b.name);
    expect(names).toContain('Original requirement');
    expect(names).toContain('New requirement');
  });
});

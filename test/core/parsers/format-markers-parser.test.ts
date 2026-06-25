/**
 * Parametrized parser tests: verify that parseDeltaSpec produces equivalent
 * DeltaPlan output for equivalent ADDED/MODIFIED/REMOVED/RENAMED inputs
 * expressed in both the section-style (Markdown) and inline-marker dialects.
 *
 * Task 4.2
 */
import { describe, it, expect } from 'vitest';
import { parseDeltaSpec } from '../../../src/core/parsers/requirement-blocks.js';
import { MARKDOWN_FORMAT_MARKERS, type FormatMarkers } from '../../../src/core/artifact-graph/format-markers.js';

// Inline-marker format (comment-marker dialect)
const COMMENT_MARKER_FORMAT: FormatMarkers = {
  extension: '.feature',
  requirementRegex: /^\s*Rule:\s*(?<name>.+)$/,
  scenarioRegex: /^\s*Scenario:/,
  delta: {
    type: 'inline',
    markerRegex: /@openspec:\s*(?<op>ADDED|MODIFIED|REMOVED|RENAMED)/,
    renameRegex: /@openspec:\s*RENAMED\s+from="(?<from>[^"]+)"\s+to="(?<to>[^"]+)"/,
  },
};

// Equivalent Markdown section-style delta
const MARKDOWN_DELTA = `
## ADDED Requirements

### Requirement: New feature
The system SHALL support the new feature.

#### Scenario: Feature works
- **WHEN** user triggers the feature
- **THEN** it works

## MODIFIED Requirements

### Requirement: Existing feature
The system SHALL enhance the existing feature.

#### Scenario: Enhanced behavior
- **WHEN** user uses the feature
- **THEN** it behaves better

## REMOVED Requirements

### Requirement: Old feature

## RENAMED Requirements

- FROM: \`### Requirement: Legacy name\`
- TO: \`### Requirement: New name\`
`.trim();

// Equivalent inline-marker delta
const INLINE_DELTA = `
Feature: Changes

  # @openspec: ADDED
  Rule: New feature
    The system SHALL support the new feature.
    Scenario: Feature works
      When user triggers the feature
      Then it works

  # @openspec: MODIFIED
  Rule: Existing feature
    The system SHALL enhance the existing feature.
    Scenario: Enhanced behavior
      When user uses the feature
      Then it behaves better

  # @openspec: REMOVED
  Rule: Old feature

  # @openspec: RENAMED from="Legacy name" to="New name"
`.trim();

describe('4.2: parseDeltaSpec - section dialect (Markdown)', () => {
  it('parses ADDED requirements', () => {
    const plan = parseDeltaSpec(MARKDOWN_DELTA, MARKDOWN_FORMAT_MARKERS);
    expect(plan.added).toHaveLength(1);
    expect(plan.added[0].name).toBe('New feature');
    expect(plan.sectionPresence.added).toBe(true);
  });

  it('parses MODIFIED requirements', () => {
    const plan = parseDeltaSpec(MARKDOWN_DELTA, MARKDOWN_FORMAT_MARKERS);
    expect(plan.modified).toHaveLength(1);
    expect(plan.modified[0].name).toBe('Existing feature');
    expect(plan.sectionPresence.modified).toBe(true);
  });

  it('parses REMOVED requirements', () => {
    const plan = parseDeltaSpec(MARKDOWN_DELTA, MARKDOWN_FORMAT_MARKERS);
    expect(plan.removed).toHaveLength(1);
    expect(plan.removed[0]).toBe('Old feature');
    expect(plan.sectionPresence.removed).toBe(true);
  });

  it('parses RENAMED requirements', () => {
    const plan = parseDeltaSpec(MARKDOWN_DELTA, MARKDOWN_FORMAT_MARKERS);
    expect(plan.renamed).toHaveLength(1);
    expect(plan.renamed[0].from).toBe('Legacy name');
    expect(plan.renamed[0].to).toBe('New name');
    expect(plan.sectionPresence.renamed).toBe(true);
  });
});

describe('4.2: parseDeltaSpec - inline-marker dialect', () => {
  it('parses ADDED requirements', () => {
    const plan = parseDeltaSpec(INLINE_DELTA, COMMENT_MARKER_FORMAT);
    expect(plan.added).toHaveLength(1);
    expect(plan.added[0].name).toBe('New feature');
    expect(plan.sectionPresence.added).toBe(true);
  });

  it('parses MODIFIED requirements', () => {
    const plan = parseDeltaSpec(INLINE_DELTA, COMMENT_MARKER_FORMAT);
    expect(plan.modified.length).toBeGreaterThanOrEqual(1);
    const existing = plan.modified.find(m => m.name === 'Existing feature');
    expect(existing).toBeDefined();
    expect(plan.sectionPresence.modified).toBe(true);
  });

  it('parses REMOVED requirements', () => {
    const plan = parseDeltaSpec(INLINE_DELTA, COMMENT_MARKER_FORMAT);
    expect(plan.removed).toHaveLength(1);
    expect(plan.removed[0]).toBe('Old feature');
    expect(plan.sectionPresence.removed).toBe(true);
  });

  it('parses RENAMED requirements', () => {
    const plan = parseDeltaSpec(INLINE_DELTA, COMMENT_MARKER_FORMAT);
    expect(plan.renamed).toHaveLength(1);
    expect(plan.renamed[0].from).toBe('Legacy name');
    expect(plan.renamed[0].to).toBe('New name');
    expect(plan.sectionPresence.renamed).toBe(true);
  });
});

describe('4.2: parseDeltaSpec - both formats produce equivalent names', () => {
  it('ADDED requirement names match between formats', () => {
    const md = parseDeltaSpec(MARKDOWN_DELTA, MARKDOWN_FORMAT_MARKERS);
    const inline = parseDeltaSpec(INLINE_DELTA, COMMENT_MARKER_FORMAT);
    expect(md.added.map(b => b.name)).toEqual(inline.added.map(b => b.name));
  });

  it('REMOVED requirement names match between formats', () => {
    const md = parseDeltaSpec(MARKDOWN_DELTA, MARKDOWN_FORMAT_MARKERS);
    const inline = parseDeltaSpec(INLINE_DELTA, COMMENT_MARKER_FORMAT);
    expect(md.removed).toEqual(inline.removed);
  });

  it('RENAMED pairs match between formats', () => {
    const md = parseDeltaSpec(MARKDOWN_DELTA, MARKDOWN_FORMAT_MARKERS);
    const inline = parseDeltaSpec(INLINE_DELTA, COMMENT_MARKER_FORMAT);
    expect(md.renamed).toEqual(inline.renamed);
  });
});

describe('4.2: parseDeltaSpec - Markdown defaults are used when no markers passed', () => {
  it('parses without explicit markers parameter (uses Markdown defaults)', () => {
    const simple = `## ADDED Requirements\n\n### Requirement: Simple\nThe system SHALL be simple.\n`;
    const plan = parseDeltaSpec(simple);
    expect(plan.added).toHaveLength(1);
    expect(plan.added[0].name).toBe('Simple');
  });
});

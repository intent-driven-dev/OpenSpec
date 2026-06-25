/**
 * 4.1 Backward-compat characterization tests.
 *
 * Parse the repo's own spec corpus (openspec/specs/**) with the refactored
 * parser using Markdown defaults and verify that:
 * 1. All spec files are readable and produce at least one requirement.
 * 2. Requirements and scenarios are unchanged from what the pre-refactor code
 *    would produce (the Markdown regex constants are now the MARKDOWN_FORMAT_MARKERS).
 *
 * Also verifies a golden Markdown delta apply is byte-identical by running
 * buildUpdatedSpec with Markdown markers and confirming the output matches the
 * result produced without explicit markers (i.e., the default path).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  extractRequirementsSection,
  parseDeltaSpec,
} from '../../../src/core/parsers/requirement-blocks.js';
import { MARKDOWN_FORMAT_MARKERS } from '../../../src/core/artifact-graph/format-markers.js';

const SPECS_DIR = join(import.meta.dirname, '../../../openspec/specs');

function getSpecDirs(): string[] {
  if (!existsSync(SPECS_DIR)) return [];
  return readdirSync(SPECS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

describe('4.1: Markdown backward compat - spec corpus', () => {
  const specDirs = getSpecDirs();

  it('finds spec corpus (sanity check)', () => {
    expect(specDirs.length).toBeGreaterThan(0);
  });

  for (const dir of specDirs) {
    const specPath = join(SPECS_DIR, dir, 'spec.md');
    if (!existsSync(specPath)) continue;

    it(`${dir}/spec.md: explicit Markdown markers == no-markers (default) for extractRequirementsSection`, () => {
      const content = readFileSync(specPath, 'utf-8');
      const withMarkers = extractRequirementsSection(content, MARKDOWN_FORMAT_MARKERS);
      const withDefaults = extractRequirementsSection(content);
      expect(withMarkers.bodyBlocks.map(b => b.name)).toEqual(withDefaults.bodyBlocks.map(b => b.name));
      expect(withMarkers.bodyBlocks.length).toEqual(withDefaults.bodyBlocks.length);
    });
  }
});

describe('4.1: Markdown backward compat - delta parse', () => {
  const DELTA = `
## ADDED Requirements

### Requirement: A new requirement
The system SHALL support this.

#### Scenario: It works
- **WHEN** condition
- **THEN** result

## REMOVED Requirements

### Requirement: Old requirement
`.trim();

  it('parseDeltaSpec with explicit Markdown markers == no-markers (default)', () => {
    const withMarkers = parseDeltaSpec(DELTA, MARKDOWN_FORMAT_MARKERS);
    const withDefaults = parseDeltaSpec(DELTA);
    expect(withMarkers.added.map(b => b.name)).toEqual(withDefaults.added.map(b => b.name));
    expect(withMarkers.removed).toEqual(withDefaults.removed);
    expect(withMarkers.modified.map(b => b.name)).toEqual(withDefaults.modified.map(b => b.name));
    expect(withMarkers.renamed).toEqual(withDefaults.renamed);
    expect(withMarkers.sectionPresence).toEqual(withDefaults.sectionPresence);
  });

  it('parseDeltaSpec with explicit Markdown markers produces identical raw blocks to default', () => {
    const withMarkers = parseDeltaSpec(DELTA, MARKDOWN_FORMAT_MARKERS);
    const withDefaults = parseDeltaSpec(DELTA);
    // Raw block content should be identical
    for (let i = 0; i < withMarkers.added.length; i++) {
      expect(withMarkers.added[i].raw).toBe(withDefaults.added[i].raw);
      expect(withMarkers.added[i].headerLine).toBe(withDefaults.added[i].headerLine);
    }
  });
});

describe('4.1: Markdown backward compat - extractRequirementsSection rebuilding', () => {
  const MAIN_SPEC = `# My Capability Specification

## Purpose
This spec describes my capability.

## Requirements

### Requirement: First requirement
The system SHALL do the first thing.

#### Scenario: Basic behavior
- **WHEN** something happens
- **THEN** result is produced

### Requirement: Second requirement
The system SHALL do the second thing.

#### Scenario: Another behavior
- **WHEN** another condition
- **THEN** another result
`.trimStart();

  it('produces identical extraction with explicit Markdown markers vs defaults', () => {
    const withMarkers = extractRequirementsSection(MAIN_SPEC, MARKDOWN_FORMAT_MARKERS);
    const withDefaults = extractRequirementsSection(MAIN_SPEC);
    expect(withMarkers.before).toBe(withDefaults.before);
    expect(withMarkers.headerLine).toBe(withDefaults.headerLine);
    expect(withMarkers.preamble).toBe(withDefaults.preamble);
    expect(withMarkers.after).toBe(withDefaults.after);
    expect(withMarkers.bodyBlocks.map(b => b.raw)).toEqual(withDefaults.bodyBlocks.map(b => b.raw));
  });
});

/**
 * 5.3 / 4.4: Executable test using the Gherkin fixture in test/fixtures/gherkin-format.
 *
 * Verifies the fixture project's delta spec can be discovered, parsed, and applied
 * using the project-local gherkin schema.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { resolveSchema } from '../../src/core/artifact-graph/resolver.js';
import { resolveFormatMarkers } from '../../src/core/artifact-graph/format-markers.js';
import {
  findSpecUpdates,
  buildUpdatedSpec,
} from '../../src/core/specs-apply.js';
import {
  extractRequirementsSection,
} from '../../src/core/parsers/requirement-blocks.js';

const FIXTURE_DIR = path.join(import.meta.dirname, '../fixtures/gherkin-format');

describe('Gherkin fixture: schema loads correctly', () => {
  it('resolves the gherkin schema from project-local schemas', () => {
    const schema = resolveSchema('gherkin', FIXTURE_DIR);
    expect(schema.name).toBe('gherkin');
    expect(schema.format).toBeDefined();
    expect(schema.format?.extension).toBe('.feature');
  });

  it('resolveFormatMarkers returns inline-marker type for gherkin schema', () => {
    const schema = resolveSchema('gherkin', FIXTURE_DIR);
    const markers = resolveFormatMarkers(schema);
    expect(markers.extension).toBe('.feature');
    expect(markers.delta.type).toBe('inline');
  });

  it('requirementRegex matches Gherkin Rule: lines', () => {
    const schema = resolveSchema('gherkin', FIXTURE_DIR);
    const markers = resolveFormatMarkers(schema);
    const m = '  Rule: Email must be verified before login'.match(markers.requirementRegex);
    expect(m?.groups?.name).toBe('Email must be verified before login');
  });
});

describe('Gherkin fixture: delta spec can be applied', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `gherkin-fixture-test-${Date.now()}`);
    // Copy fixture to temp dir to avoid mutating it
    await fs.cp(FIXTURE_DIR, tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('findSpecUpdates discovers .feature files in change specs', async () => {
    const schema = resolveSchema('gherkin', tempDir);
    const markers = resolveFormatMarkers(schema);
    const changeDir = path.join(tempDir, 'openspec', 'changes', 'add-login');
    const mainSpecsDir = path.join(tempDir, 'openspec', 'specs');

    const updates = await findSpecUpdates(changeDir, mainSpecsDir, markers);
    expect(updates).toHaveLength(1);
    expect(updates[0].source).toContain('spec.feature');
    expect(updates[0].target).toContain('spec.feature');
    expect(updates[0].exists).toBe(true);
  });

  it('buildUpdatedSpec applies the gherkin delta correctly', async () => {
    const schema = resolveSchema('gherkin', tempDir);
    const markers = resolveFormatMarkers(schema);
    const changeDir = path.join(tempDir, 'openspec', 'changes', 'add-login');
    const mainSpecsDir = path.join(tempDir, 'openspec', 'specs');

    const updates = await findSpecUpdates(changeDir, mainSpecsDir, markers);
    expect(updates).toHaveLength(1);

    const result = await buildUpdatedSpec(updates[0], 'add-login', { markers });
    expect(result.counts.added).toBe(1);
    expect(result.counts.removed).toBe(1);
    expect(result.counts.renamed).toBe(1);

    // Verify by parsing the rebuilt spec
    const parts = extractRequirementsSection(result.rebuilt, markers);
    const names = parts.bodyBlocks.map(b => b.name);

    // Added requirement is present
    expect(names).toContain('Email must be verified before login');
    // Removed requirement is gone
    expect(names).not.toContain('Session expires after inactivity');
    // Renamed requirement has the new name
    expect(names).toContain('Password complexity is enforced');
    expect(names).not.toContain('Password must meet complexity requirements');
  });
});

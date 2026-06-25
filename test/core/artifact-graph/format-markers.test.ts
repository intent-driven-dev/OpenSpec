import { describe, it, expect } from 'vitest';
import { parseSchema, SchemaValidationError } from '../../../src/core/artifact-graph/schema.js';
import { resolveFormatMarkers, MARKDOWN_FORMAT_MARKERS } from '../../../src/core/artifact-graph/format-markers.js';

const BASE_SCHEMA_YAML = `
name: test-schema
version: 1
artifacts:
  - id: proposal
    generates: proposal.md
    description: Proposal
    template: proposal.md
    requires: []
`;

describe('resolveFormatMarkers', () => {
  it('returns Markdown defaults when schema has no format block', () => {
    const schema = parseSchema(BASE_SCHEMA_YAML);
    const markers = resolveFormatMarkers(schema);
    expect(markers.extension).toBe('.md');
    expect(markers.requirementRegex.source).toBe(MARKDOWN_FORMAT_MARKERS.requirementRegex.source);
    expect(markers.scenarioRegex?.source).toBe(MARKDOWN_FORMAT_MARKERS.scenarioRegex?.source);
    expect(markers.delta.type).toBe('section');
  });

  it('returns compiled RegExp objects for a schema with format block', () => {
    const yaml = `${BASE_SCHEMA_YAML}
format:
  extension: ".feature"
  requirement: '^\\\\s*Rule:\\\\s*(?<name>.+)$'
  scenario: '^\\\\s*Scenario:'
  delta:
    marker: '@openspec:\\\\s*(?<op>ADDED|MODIFIED|REMOVED|RENAMED)'
    rename: '@openspec:\\\\s*RENAMED\\\\s+from="(?<from>[^"]+)"\\\\s+to="(?<to>[^"]+)"'
`;
    const schema = parseSchema(yaml);
    const markers = resolveFormatMarkers(schema);
    expect(markers.extension).toBe('.feature');
    expect(markers.requirementRegex).toBeInstanceOf(RegExp);
    expect(markers.scenarioRegex).toBeInstanceOf(RegExp);
    expect(markers.delta.type).toBe('inline');
  });

  it('Markdown defaults have named capture "name" in requirementRegex', () => {
    const m = '### Requirement: Some Name'.match(MARKDOWN_FORMAT_MARKERS.requirementRegex);
    expect(m?.groups?.name).toBe('Some Name');
  });

  it('Markdown defaults have section-type delta', () => {
    const markers = MARKDOWN_FORMAT_MARKERS;
    expect(markers.delta.type).toBe('section');
    if (markers.delta.type === 'section') {
      expect('## ADDED Requirements'.match(markers.delta.addedRegex)).toBeTruthy();
      expect('## MODIFIED Requirements'.match(markers.delta.modifiedRegex)).toBeTruthy();
      expect('## REMOVED Requirements'.match(markers.delta.removedRegex)).toBeTruthy();
      expect('## RENAMED Requirements'.match(markers.delta.renamedRegex)).toBeTruthy();
    }
  });
});

describe('schema format validation', () => {
  it('4.3: rejects malformed requirement pattern', () => {
    const yaml = `${BASE_SCHEMA_YAML}
format:
  extension: ".md"
  requirement: '[invalid('
  delta:
    added: '^## ADDED'
    modified: '^## MODIFIED'
    removed: '^## REMOVED'
    renamed: '^## RENAMED'
`;
    expect(() => parseSchema(yaml)).toThrow(SchemaValidationError);
    expect(() => parseSchema(yaml)).toThrow(/format\.requirement/);
  });

  it('4.3: rejects requirement pattern missing named capture "name"', () => {
    const yaml = `${BASE_SCHEMA_YAML}
format:
  extension: ".md"
  requirement: '^###\\\\s+Requirement:\\\\s+(.+)$'
  delta:
    added: '^## ADDED'
    modified: '^## MODIFIED'
    removed: '^## REMOVED'
    renamed: '^## RENAMED'
`;
    expect(() => parseSchema(yaml)).toThrow(SchemaValidationError);
    expect(() => parseSchema(yaml)).toThrow(/format\.requirement/);
    expect(() => parseSchema(yaml)).toThrow(/name/);
  });

  it('4.3: rejects inline marker missing "op" capture', () => {
    const yaml = `${BASE_SCHEMA_YAML}
format:
  extension: ".feature"
  requirement: '^\\\\s*Rule:\\\\s*(?<name>.+)$'
  delta:
    marker: '@openspec:\\\\s*(ADDED|MODIFIED|REMOVED|RENAMED)'
    rename: '@openspec:\\\\s*RENAMED\\\\s+from="(?<from>[^"]+)"\\\\s+to="(?<to>[^"]+)"'
`;
    expect(() => parseSchema(yaml)).toThrow(SchemaValidationError);
    expect(() => parseSchema(yaml)).toThrow(/format\.delta\.marker/);
    expect(() => parseSchema(yaml)).toThrow(/op/);
  });

  it('4.3: rejects rename pattern missing "from" capture', () => {
    const yaml = `${BASE_SCHEMA_YAML}
format:
  extension: ".feature"
  requirement: '^\\\\s*Rule:\\\\s*(?<name>.+)$'
  delta:
    marker: '@openspec:\\\\s*(?<op>ADDED|MODIFIED|REMOVED|RENAMED)'
    rename: '@openspec:\\\\s*RENAMED\\\\s+from="([^"]+)"\\\\s+to="(?<to>[^"]+)"'
`;
    expect(() => parseSchema(yaml)).toThrow(SchemaValidationError);
    expect(() => parseSchema(yaml)).toThrow(/format\.delta\.rename/);
    expect(() => parseSchema(yaml)).toThrow(/from/);
  });

  it('accepts valid section-style format block', () => {
    const yaml = `${BASE_SCHEMA_YAML}
format:
  extension: ".md"
  requirement: '^###\\\\s+Requirement:\\\\s*(?<name>.+)$'
  scenario: '^####\\\\s+Scenario:'
  delta:
    added: '^##\\\\s+ADDED Requirements'
    modified: '^##\\\\s+MODIFIED Requirements'
    removed: '^##\\\\s+REMOVED Requirements'
    renamed: '^##\\\\s+RENAMED Requirements'
`;
    expect(() => parseSchema(yaml)).not.toThrow();
  });

  it('accepts valid inline-marker format block', () => {
    const yaml = `${BASE_SCHEMA_YAML}
format:
  extension: ".feature"
  requirement: '^\\\\s*Rule:\\\\s*(?<name>.+)$'
  delta:
    marker: '@openspec:\\\\s*(?<op>ADDED|MODIFIED|REMOVED|RENAMED)'
    rename: '@openspec:\\\\s*RENAMED\\\\s+from="(?<from>[^"]+)"\\\\s+to="(?<to>[^"]+)"'
`;
    expect(() => parseSchema(yaml)).not.toThrow();
  });

  it('4.5: user-forked schema without format block resolves to Markdown defaults', () => {
    // Simulate a user-forked schema that only has name/version/artifacts (no format)
    const userForkedSchema = parseSchema(`
name: my-custom-schema
version: 1
description: A user-forked schema without format block
artifacts:
  - id: proposal
    generates: proposal.md
    description: Proposal
    template: proposal.md
    requires: []
`);
    const markers = resolveFormatMarkers(userForkedSchema);
    expect(markers.extension).toBe('.md');
    expect(markers.delta.type).toBe('section');
    // Verify the markers match the known Markdown defaults
    if (markers.delta.type === 'section') {
      expect(markers.delta.addedRegex.source).toBe(MARKDOWN_FORMAT_MARKERS.delta.type === 'section' ? MARKDOWN_FORMAT_MARKERS.delta.addedRegex.source : '');
    }
  });
});

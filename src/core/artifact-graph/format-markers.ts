import type { SchemaYaml } from './types.js';

// ─── Resolved types (compiled RegExp) ────────────────────────────────────────

export interface FormatDeltaSectionResolved {
  type: 'section';
  addedRegex: RegExp;
  modifiedRegex: RegExp;
  removedRegex: RegExp;
  renamedRegex: RegExp;
}

export interface FormatDeltaInlineResolved {
  type: 'inline';
  markerRegex: RegExp;  // named capture 'op'
  renameRegex: RegExp;  // named captures 'from' and 'to'
}

export type FormatDeltaResolved = FormatDeltaSectionResolved | FormatDeltaInlineResolved;

export interface FormatMarkers {
  extension: string;
  requirementRegex: RegExp;  // named capture 'name'
  scenarioRegex?: RegExp;
  delta: FormatDeltaResolved;
}

// ─── Markdown defaults ────────────────────────────────────────────────────────

export const MARKDOWN_FORMAT_MARKERS: FormatMarkers = {
  extension: '.md',
  requirementRegex: /^###\s*Requirement:\s*(?<name>.+)\s*$/i,
  scenarioRegex: /^####\s*Scenario:/i,
  delta: {
    type: 'section',
    addedRegex: /^##\s+ADDED Requirements\s*$/i,
    modifiedRegex: /^##\s+MODIFIED Requirements\s*$/i,
    removedRegex: /^##\s+REMOVED Requirements\s*$/i,
    renamedRegex: /^##\s+RENAMED Requirements\s*$/i,
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns the resolved FormatMarkers for a schema.
 * When the schema has no `format` block, returns the built-in Markdown defaults.
 */
export function resolveFormatMarkers(schema: SchemaYaml): FormatMarkers {
  const fmt = schema.format;
  if (!fmt) return MARKDOWN_FORMAT_MARKERS;

  const requirementRegex = new RegExp(fmt.requirement);
  const scenarioRegex = fmt.scenario ? new RegExp(fmt.scenario) : undefined;

  let delta: FormatDeltaResolved;
  if ('marker' in fmt.delta) {
    delta = {
      type: 'inline',
      markerRegex: new RegExp(fmt.delta.marker),
      renameRegex: new RegExp(fmt.delta.rename),
    };
  } else {
    delta = {
      type: 'section',
      addedRegex: new RegExp(fmt.delta.added),
      modifiedRegex: new RegExp(fmt.delta.modified),
      removedRegex: new RegExp(fmt.delta.removed),
      renamedRegex: new RegExp(fmt.delta.renamed),
    };
  }

  return { extension: fmt.extension, requirementRegex, scenarioRegex, delta };
}

import { MARKDOWN_FORMAT_MARKERS, type FormatMarkers } from '../artifact-graph/format-markers.js';
import { buildCodeFenceMask } from './requirement-text.js';

export interface RequirementBlock {
  headerLine: string; // e.g., '### Requirement: Something'
  name: string; // e.g., 'Something'
  raw: string; // full block including headerLine and following content
}

export interface RequirementsSectionParts {
  before: string;
  headerLine: string; // the '## Requirements' line (empty for non-section formats)
  preamble: string; // content between headerLine and first requirement block
  bodyBlocks: RequirementBlock[]; // parsed requirement blocks in order
  after: string;
}

export function normalizeRequirementName(name: string): string {
  return name.trim();
}

/**
 * Extracts the Requirements section from a spec file and parses requirement blocks.
 * Supports both Markdown section-style (## Requirements) and inline formats.
 */
export function extractRequirementsSection(
  content: string,
  markers: FormatMarkers = MARKDOWN_FORMAT_MARKERS
): RequirementsSectionParts {
  const normalized = normalizeLineEndings(content);

  if (markers.delta.type === 'inline') {
    return extractRequirementsSectionInline(normalized, markers);
  }
  return extractRequirementsSectionMarkdown(normalized, markers);
}

function extractRequirementsSectionMarkdown(
  normalized: string,
  markers: FormatMarkers
): RequirementsSectionParts {
  const lines = normalized.split('\n');
  const reqHeaderIndex = lines.findIndex(l => /^##\s+Requirements\s*$/i.test(l));

  if (reqHeaderIndex === -1) {
    // No requirements section; create an empty one at the end
    const before = normalized.trimEnd();
    const headerLine = '## Requirements';
    return {
      before: before ? before + '\n\n' : '',
      headerLine,
      preamble: '',
      bodyBlocks: [],
      after: '\n',
    };
  }

  // Find end of this section: next line that starts with '## ' at same or higher level
  let endIndex = lines.length;
  for (let i = reqHeaderIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  const before = lines.slice(0, reqHeaderIndex).join('\n');
  const headerLine = lines[reqHeaderIndex];
  const sectionBodyLines = lines.slice(reqHeaderIndex + 1, endIndex);

  const blocks: RequirementBlock[] = [];
  let cursor = 0;
  let preambleLines: string[] = [];

  while (cursor < sectionBodyLines.length && !markers.requirementRegex.test(sectionBodyLines[cursor])) {
    preambleLines.push(sectionBodyLines[cursor]);
    cursor++;
  }

  while (cursor < sectionBodyLines.length) {
    const headerLineCandidate = sectionBodyLines[cursor];
    const headerMatch = headerLineCandidate.match(markers.requirementRegex);
    if (!headerMatch) {
      cursor++;
      continue;
    }
    const name = normalizeRequirementName(headerMatch.groups?.name ?? headerMatch[1] ?? '');
    cursor++;
    const bodyLines: string[] = [headerLineCandidate];
    while (
      cursor < sectionBodyLines.length &&
      !markers.requirementRegex.test(sectionBodyLines[cursor]) &&
      !/^##\s+/.test(sectionBodyLines[cursor])
    ) {
      bodyLines.push(sectionBodyLines[cursor]);
      cursor++;
    }
    const raw = bodyLines.join('\n').trimEnd();
    blocks.push({ headerLine: headerLineCandidate, name, raw });
  }

  const after = lines.slice(endIndex).join('\n');
  const preamble = preambleLines.join('\n').trimEnd();

  return {
    before: before.trimEnd() ? before + '\n' : before,
    headerLine,
    preamble,
    bodyBlocks: blocks,
    after: after.startsWith('\n') ? after : '\n' + after,
  };
}

function extractRequirementsSectionInline(
  normalized: string,
  markers: FormatMarkers
): RequirementsSectionParts {
  // For inline formats, requirements are top-level constructs identified by requirementRegex.
  // Scan the whole file; each match starts a block that extends to the next match.
  const lines = normalized.split('\n');
  const blocks: RequirementBlock[] = [];
  let firstReqLine = -1;

  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(markers.requirementRegex);
    if (!m) {
      i++;
      continue;
    }
    if (firstReqLine === -1) firstReqLine = i;
    const headerLineCandidate = lines[i];
    const name = normalizeRequirementName(m.groups?.name ?? m[1] ?? '');
    const bodyLines: string[] = [headerLineCandidate];
    i++;
    while (i < lines.length && !markers.requirementRegex.test(lines[i])) {
      bodyLines.push(lines[i]);
      i++;
    }
    blocks.push({ headerLine: headerLineCandidate, name, raw: bodyLines.join('\n').trimEnd() });
  }

  const before = firstReqLine > 0 ? lines.slice(0, firstReqLine).join('\n') : '';

  return {
    before: before.trimEnd() ? before.trimEnd() + '\n' : '',
    headerLine: '',
    preamble: '',
    bodyBlocks: blocks,
    after: '\n',
  };
}

/**
 * A level-3 header inside `## ADDED`/`## MODIFIED Requirements` that is not a
 * canonical `### Requirement:` header, recorded at the moment the delta reader
 * skips over it. Surfaced as an INFO note by `validate <change>` (#498).
 */
export interface SkippedHeader {
  header: string; // header text without the leading ###
  section: string; // the ## section title as written
  line: number; // 1-based line number in the delta file
}

export interface DeltaPlan {
  added: RequirementBlock[];
  modified: RequirementBlock[];
  removed: string[]; // requirement names
  renamed: Array<{ from: string; to: string }>;
  skippedHeaders: SkippedHeader[]; // non-canonical ### headers the reader skipped
  sectionPresence: {
    added: boolean;
    modified: boolean;
    removed: boolean;
    renamed: boolean;
  };
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

/**
 * Parse a delta-formatted spec change file content into a DeltaPlan with raw blocks.
 * Supports both the section dialect (Markdown ## headers) and the inline-marker dialect.
 */
export function parseDeltaSpec(
  content: string,
  markers: FormatMarkers = MARKDOWN_FORMAT_MARKERS
): DeltaPlan {
  const normalized = normalizeLineEndings(content);

  if (markers.delta.type === 'inline') {
    return parseDeltaSpecInline(normalized, markers);
  }
  return parseDeltaSpecSection(normalized, markers);
}

function parseDeltaSpecSection(
  normalized: string,
  markers: FormatMarkers
): DeltaPlan {
  const delta = markers.delta;
  if (delta.type !== 'section') throw new Error('Expected section delta');
  const sections = splitTopLevelSectionsByRegex(normalized, delta);
  const addedLookup = sections.added;
  const modifiedLookup = sections.modified;
  const removedLookup = sections.removed;
  const renamedLookup = sections.renamed;
  const skippedHeaders: SkippedHeader[] = [];
  const added = parseRequirementBlocksFromSection(addedLookup.body, markers, {
    section: addedLookup.title,
    bodyStartLine: addedLookup.bodyStartLine,
    sink: skippedHeaders,
  });
  const modified = parseRequirementBlocksFromSection(modifiedLookup.body, markers, {
    section: modifiedLookup.title,
    bodyStartLine: modifiedLookup.bodyStartLine,
    sink: skippedHeaders,
  });
  const removedNames = parseRemovedNames(removedLookup.body, markers);
  const renamedPairs = parseRenamedPairs(renamedLookup.body, markers);
  skippedHeaders.sort((a, b) => a.line - b.line);
  return {
    added,
    modified,
    removed: removedNames,
    renamed: renamedPairs,
    skippedHeaders,
    sectionPresence: {
      added: addedLookup.found,
      modified: modifiedLookup.found,
      removed: removedLookup.found,
      renamed: renamedLookup.found,
    },
  };
}

function parseDeltaSpecInline(
  normalized: string,
  markers: FormatMarkers
): DeltaPlan {
  const delta = markers.delta;
  if (delta.type !== 'inline') throw new Error('Expected inline delta');

  const lines = normalized.split('\n');
  const added: RequirementBlock[] = [];
  const modified: RequirementBlock[] = [];
  const removed: string[] = [];
  const renamed: Array<{ from: string; to: string }> = [];

  let pendingOp: string | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check for rename marker (more specific than generic marker)
    const renameMatch = line.match(delta.renameRegex);
    if (renameMatch) {
      const from = renameMatch.groups?.from ?? '';
      const to = renameMatch.groups?.to ?? '';
      if (from && to) {
        renamed.push({ from: normalizeRequirementName(from), to: normalizeRequirementName(to) });
      }
      pendingOp = null;
      i++;
      continue;
    }

    // Check for generic op marker
    const markerMatch = line.match(delta.markerRegex);
    if (markerMatch) {
      const op = markerMatch.groups?.op ?? '';
      pendingOp = op.toUpperCase();
      i++;
      continue;
    }

    // Check for requirement header
    const reqMatch = line.match(markers.requirementRegex);
    if (reqMatch) {
      const name = normalizeRequirementName(reqMatch.groups?.name ?? reqMatch[1] ?? '');
      const headerLineCandidate = line;
      const bodyLines: string[] = [line];
      i++;
      while (i < lines.length && !markers.requirementRegex.test(lines[i]) && !lines[i].match(delta.markerRegex)) {
        bodyLines.push(lines[i]);
        i++;
      }
      const raw = bodyLines.join('\n').trimEnd();
      const block: RequirementBlock = { headerLine: headerLineCandidate, name, raw };

      switch (pendingOp) {
        case 'ADDED':
          added.push(block);
          break;
        case 'MODIFIED':
          modified.push(block);
          break;
        case 'REMOVED':
          removed.push(name);
          break;
        case 'RENAMED':
          // For inline renamed, the rename marker already captured from/to
          // The requirement block following RENAMED is the new version
          modified.push(block);
          break;
      }
      pendingOp = null;
      continue;
    }

    i++;
  }

  const hasAdded = added.length > 0;
  const hasModified = modified.length > 0;
  const hasRemoved = removed.length > 0;
  const hasRenamed = renamed.length > 0;

  return {
    added,
    modified,
    removed,
    renamed,
    // Inline formats have no `###` divider concept to skip over
    skippedHeaders: [],
    sectionPresence: {
      added: hasAdded,
      modified: hasModified,
      removed: hasRemoved,
      renamed: hasRenamed,
    },
  };
}

interface SectionLookup {
  body: string;
  found: boolean;
  title: string; // the section header text as written (for skipped-header notes)
  bodyStartLine: number; // 1-based line number of the first body line
}

interface SectionMap {
  added: SectionLookup;
  modified: SectionLookup;
  removed: SectionLookup;
  renamed: SectionLookup;
}

function splitTopLevelSectionsByRegex(
  content: string,
  delta: { type: 'section'; addedRegex: RegExp; modifiedRegex: RegExp; removedRegex: RegExp; renamedRegex: RegExp }
): SectionMap {
  const lines = content.split('\n');
  const result: SectionMap = {
    added: { body: '', found: false, title: 'ADDED Requirements', bodyStartLine: 0 },
    modified: { body: '', found: false, title: 'MODIFIED Requirements', bodyStartLine: 0 },
    removed: { body: '', found: false, title: 'REMOVED Requirements', bodyStartLine: 0 },
    renamed: { body: '', found: false, title: 'RENAMED Requirements', bodyStartLine: 0 },
  };

  // Track which key each section maps to
  const indices: Array<{ key: keyof SectionMap; index: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (delta.addedRegex.test(line)) indices.push({ key: 'added', index: i });
    else if (delta.modifiedRegex.test(line)) indices.push({ key: 'modified', index: i });
    else if (delta.removedRegex.test(line)) indices.push({ key: 'removed', index: i });
    else if (delta.renamedRegex.test(line)) indices.push({ key: 'renamed', index: i });
  }

  for (let i = 0; i < indices.length; i++) {
    const current = indices[i];
    const next = indices[i + 1];
    const body = lines.slice(current.index + 1, next ? next.index : lines.length).join('\n');
    const headerLine = lines[current.index];
    const title = headerLine.replace(/^##\s+/, '').trim() || headerLine.trim();
    // First body line, 1-based: the header is at 0-based current.index.
    result[current.key] = { body, found: true, title, bodyStartLine: current.index + 2 };
  }

  return result;
}

function parseRequirementBlocksFromSection(
  sectionBody: string,
  markers: FormatMarkers,
  skipped?: { section: string; bodyStartLine: number; sink: SkippedHeader[] }
): RequirementBlock[] {
  if (!sectionBody) return [];
  const lines = normalizeLineEndings(sectionBody).split('\n');
  // Record the non-canonical level-3 headers this reader skips, at the moment
  // it skips them, so the INFO note describes the reader's real boundaries.
  // Fence-masked lines are excluded: the body reader treats them as fenced
  // content, not as headers.
  const fenceMask = skipped ? buildCodeFenceMask(lines) : undefined;
  const recordIfSkippedHeader = (index: number) => {
    if (!skipped || fenceMask![index]) return;
    const h3 = lines[index].match(/^###\s+(.+?)\s*$/);
    if (h3 && !markers.requirementRegex.test(lines[index])) {
      skipped.sink.push({
        header: h3[1].trim(),
        section: skipped.section,
        line: skipped.bodyStartLine + index,
      });
    }
  };
  const blocks: RequirementBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    // Seek next requirement header
    while (i < lines.length && !markers.requirementRegex.test(lines[i])) {
      recordIfSkippedHeader(i);
      i++;
    }
    if (i >= lines.length) break;
    const headerLine = lines[i];
    const m = headerLine.match(markers.requirementRegex);
    if (!m) { i++; continue; }
    const name = normalizeRequirementName(m.groups?.name ?? m[1] ?? '');
    const buf: string[] = [headerLine];
    i++;
    while (
      i < lines.length &&
      !markers.requirementRegex.test(lines[i]) &&
      !/^##\s+/.test(lines[i])
    ) {
      recordIfSkippedHeader(i);
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ headerLine, name, raw: buf.join('\n').trimEnd() });
  }
  return blocks;
}

function parseRemovedNames(sectionBody: string, markers: FormatMarkers): string[] {
  if (!sectionBody) return [];
  const names: string[] = [];
  const lines = normalizeLineEndings(sectionBody).split('\n');
  for (const line of lines) {
    const m = line.match(markers.requirementRegex);
    if (m) {
      names.push(normalizeRequirementName(m.groups?.name ?? m[1] ?? ''));
      continue;
    }
    // Also support bullet list style: `- <header>` or `- \`<header>\``
    // Try stripping leading list marker and backtick wrapper, then test again
    const stripped = line.replace(/^\s*-\s*`?/, '').replace(/`?\s*$/, '');
    const m2 = stripped.match(markers.requirementRegex);
    if (m2) {
      names.push(normalizeRequirementName(m2.groups?.name ?? m2[1] ?? ''));
    }
  }
  return names;
}

function parseRenamedPairs(
  sectionBody: string,
  markers: FormatMarkers
): Array<{ from: string; to: string }> {
  if (!sectionBody) return [];
  const pairs: Array<{ from: string; to: string }> = [];
  const lines = normalizeLineEndings(sectionBody).split('\n');
  let current: { from?: string; to?: string } = {};

  // Helper: strip leading list marker and backtick wrapper, then extract name
  function extractName(line: string): string | null {
    const stripped = line.replace(/^\s*-?\s*(?:FROM:|TO:)\s*`?/, '').replace(/`?\s*$/, '');
    const m = stripped.match(markers.requirementRegex);
    return m ? normalizeRequirementName(m.groups?.name ?? m[1] ?? '') : null;
  }

  for (const line of lines) {
    const isFrom = /^\s*-?\s*FROM:/i.test(line);
    const isTo = /^\s*-?\s*TO:/i.test(line);

    if (isFrom) {
      const name = extractName(line);
      if (name) current.from = name;
    } else if (isTo) {
      const name = extractName(line);
      if (name) current.to = name;
      if (current.from && current.to) {
        pairs.push({ from: current.from, to: current.to });
        current = {};
      }
    }
  }
  return pairs;
}

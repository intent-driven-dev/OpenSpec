import { MARKDOWN_FORMAT_MARKERS, type FormatMarkers } from '../artifact-graph/format-markers.js';

export interface MainSpecStructureIssue {
  kind: 'delta-header' | 'requirement-outside-requirements';
  line: number;
  header: string;
  message: string;
}

export function findMainSpecStructureIssues(
  content: string,
  markers: FormatMarkers = MARKDOWN_FORMAT_MARKERS
): MainSpecStructureIssue[] {
  const normalized = content.replace(/\r\n?/g, '\n');
  const stripped = stripFencedCodeBlocksPreservingLines(normalized);
  const lines = stripped.split('\n');
  const issues: MainSpecStructureIssue[] = [];

  // For inline-dialect formats, requirements are top-level and there is no
  // ## Requirements section — skip the section-containment check.
  if (markers.delta.type === 'inline') {
    return issues;
  }

  const delta = markers.delta;
  const requirementsHeaderIndex = lines.findIndex(line => /^##\s+Requirements\s*$/i.test(line));
  let requirementsEndIndex = lines.length;

  if (requirementsHeaderIndex !== -1) {
    for (let i = requirementsHeaderIndex + 1; i < lines.length; i++) {
      if (/^##\s+/.test(lines[i])) {
        requirementsEndIndex = i;
        break;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // Check for delta headers (ADDED/MODIFIED/REMOVED/RENAMED sections)
    const isDeltaHeader =
      delta.addedRegex.test(line) ||
      delta.modifiedRegex.test(line) ||
      delta.removedRegex.test(line) ||
      delta.renamedRegex.test(line);

    if (isDeltaHeader) {
      issues.push({
        kind: 'delta-header',
        line: i + 1,
        header: trimmed,
        message:
          `Main spec contains delta header "${trimmed}". ` +
          `Delta headers are only valid inside openspec/changes/<name>/specs/<capability>/spec${markers.extension} ` +
          'and truncate the parsed ## Requirements section.',
      });
      continue;
    }

    const requirementMatch = line.match(markers.requirementRegex);
    if (!requirementMatch) {
      continue;
    }

    const insideRequirements =
      requirementsHeaderIndex !== -1 &&
      i > requirementsHeaderIndex &&
      i < requirementsEndIndex;

    if (!insideRequirements) {
      issues.push({
        kind: 'requirement-outside-requirements',
        line: i + 1,
        header: trimmed,
        message:
          `Requirement header "${trimmed}" appears outside the main ## Requirements section. ` +
          'Main specs only parse requirements inside that section, so this requirement is currently invisible to validate, list, and archive.',
      });
    }
  }

  return issues;
}

export function stripFencedCodeBlocksPreservingLines(content: string): string {
  const lines = content.split('\n');
  const output: string[] = [];
  let activeFence: { marker: '`' | '~'; length: number } | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})(.*)$/);

    if (!activeFence) {
      if (fenceMatch) {
        activeFence = {
          marker: fenceMatch[1][0] as '`' | '~',
          length: fenceMatch[1].length,
        };
        output.push('');
      } else {
        output.push(line);
      }
      continue;
    }

    output.push('');

    if (isClosingFence(line, activeFence)) {
      activeFence = null;
    }
  }

  return output.join('\n');
}

function isClosingFence(
  line: string,
  activeFence: { marker: '`' | '~'; length: number }
): boolean {
  const fenceMatch = line.match(/^\s*(`{3,}|~{3,})\s*$/);
  return Boolean(
    fenceMatch &&
    fenceMatch[1][0] === activeFence.marker &&
    fenceMatch[1].length >= activeFence.length
  );
}

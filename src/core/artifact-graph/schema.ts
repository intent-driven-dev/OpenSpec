import * as fs from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { SchemaYamlSchema, type SchemaYaml, type Artifact, type SchemaFormat } from './types.js';

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Loads and validates an artifact schema from a YAML file.
 */
export function loadSchema(filePath: string): SchemaYaml {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseSchema(content);
}

/**
 * Parses and validates an artifact schema from YAML content.
 */
export function parseSchema(yamlContent: string): SchemaYaml {
  const parsed = parseYaml(yamlContent);

  // Validate with Zod
  const result = SchemaYamlSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new SchemaValidationError(`Invalid schema: ${errors}`);
  }

  const schema = result.data;

  // Validate format block if present
  if (schema.format) {
    validateFormatBlock(schema.format);
  }

  // Check for duplicate artifact IDs
  validateNoDuplicateIds(schema.artifacts);

  // Check that all requires references are valid
  validateRequiresReferences(schema.artifacts);

  // Check for cycles
  validateNoCycles(schema.artifacts);

  return schema;
}

/**
 * Validates that there are no duplicate artifact IDs.
 */
function validateNoDuplicateIds(artifacts: Artifact[]): void {
  const seen = new Set<string>();
  for (const artifact of artifacts) {
    if (seen.has(artifact.id)) {
      throw new SchemaValidationError(`Duplicate artifact ID: ${artifact.id}`);
    }
    seen.add(artifact.id);
  }
}

/**
 * Validates that all `requires` references point to valid artifact IDs.
 */
function validateRequiresReferences(artifacts: Artifact[]): void {
  const validIds = new Set(artifacts.map(a => a.id));

  for (const artifact of artifacts) {
    for (const req of artifact.requires) {
      if (!validIds.has(req)) {
        throw new SchemaValidationError(
          `Invalid dependency reference in artifact '${artifact.id}': '${req}' does not exist`
        );
      }
    }
  }
}

/**
 * Validates the format block: each pattern must be a valid regex and must
 * contain the expected named captures.
 */
function validateFormatBlock(format: SchemaFormat): void {
  function compileOrThrow(pattern: string, field: string): RegExp {
    try {
      return new RegExp(pattern);
    } catch {
      throw new SchemaValidationError(
        `format.${field}: pattern "${pattern}" is not a valid regular expression`
      );
    }
  }

  function requireNamedGroup(regex: RegExp, groupName: string, field: string): void {
    // Test named capture by running against a dummy string and checking groups key
    const source = regex.source;
    if (!source.includes(`(?<${groupName}>`)) {
      throw new SchemaValidationError(
        `format.${field}: pattern must include a named capture (?<${groupName}>...)`
      );
    }
  }

  const reqRegex = compileOrThrow(format.requirement, 'requirement');
  requireNamedGroup(reqRegex, 'name', 'requirement');

  if (format.scenario !== undefined) {
    compileOrThrow(format.scenario, 'scenario');
  }

  if ('marker' in format.delta) {
    // Inline dialect
    const markerRegex = compileOrThrow(format.delta.marker, 'delta.marker');
    requireNamedGroup(markerRegex, 'op', 'delta.marker');
    const renameRegex = compileOrThrow(format.delta.rename, 'delta.rename');
    requireNamedGroup(renameRegex, 'from', 'delta.rename');
    requireNamedGroup(renameRegex, 'to', 'delta.rename');
  } else {
    // Section dialect
    compileOrThrow(format.delta.added, 'delta.added');
    compileOrThrow(format.delta.modified, 'delta.modified');
    compileOrThrow(format.delta.removed, 'delta.removed');
    compileOrThrow(format.delta.renamed, 'delta.renamed');
  }
}

/**
 * Validates that there are no cyclic dependencies.
 * Uses DFS to detect cycles and reports the full cycle path.
 */
function validateNoCycles(artifacts: Artifact[]): void {
  const artifactMap = new Map(artifacts.map(a => [a.id, a]));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parent = new Map<string, string>();

  function dfs(id: string): string | null {
    visited.add(id);
    inStack.add(id);

    const artifact = artifactMap.get(id);
    if (!artifact) return null;

    for (const dep of artifact.requires) {
      if (!visited.has(dep)) {
        parent.set(dep, id);
        const cycle = dfs(dep);
        if (cycle) return cycle;
      } else if (inStack.has(dep)) {
        // Found a cycle - reconstruct the path
        const cyclePath = [dep];
        let current = id;
        while (current !== dep) {
          cyclePath.unshift(current);
          current = parent.get(current)!;
        }
        cyclePath.unshift(dep);
        return cyclePath.join(' → ');
      }
    }

    inStack.delete(id);
    return null;
  }

  for (const artifact of artifacts) {
    if (!visited.has(artifact.id)) {
      const cycle = dfs(artifact.id);
      if (cycle) {
        throw new SchemaValidationError(`Cyclic dependency detected: ${cycle}`);
      }
    }
  }
}

import { z } from 'zod';

// Delta section dialect: operation determined by which ## section a block is under
export const FormatDeltaSectionSchema = z.object({
  added: z.string().min(1),
  modified: z.string().min(1),
  removed: z.string().min(1),
  renamed: z.string().min(1),
});

// Delta inline dialect: operation determined by a marker line preceding each requirement
export const FormatDeltaInlineSchema = z.object({
  marker: z.string().min(1),  // must capture named group 'op'
  rename: z.string().min(1),  // must capture named groups 'from' and 'to'
});

export const FormatDeltaSchema = z.union([FormatDeltaSectionSchema, FormatDeltaInlineSchema]);

// Optional format block that tells OpenSpec how to recognize a spec's structure
export const FormatSchema = z.object({
  extension: z.string().min(1),    // spec file extension, e.g. '.md' or '.feature'
  requirement: z.string().min(1),  // regex with named group 'name'
  scenario: z.string().optional(), // optional regex; when absent, scenario rigor is skipped
  delta: FormatDeltaSchema,
});

// Artifact definition schema
export const ArtifactSchema = z.object({
  id: z.string().min(1, { error: 'Artifact ID is required' }),
  generates: z.string().min(1, { error: 'generates field is required' }),
  description: z.string(),
  template: z.string().min(1, { error: 'template field is required' }),
  instruction: z.string().optional(),
  requires: z.array(z.string()).default([]),
});

// Apply phase configuration for schema-aware apply instructions
export const ApplyPhaseSchema = z.object({
  // Artifact IDs that must exist before apply is available
  requires: z.array(z.string()).min(1, { error: 'At least one required artifact' }),
  // Path to file with checkboxes for progress (relative to change dir), or null if no tracking
  tracks: z.string().nullable().optional(),
  // Custom guidance for the apply phase
  instruction: z.string().optional(),
});

// Full schema YAML structure
export const SchemaYamlSchema = z.object({
  name: z.string().min(1, { error: 'Schema name is required' }),
  version: z.number().int().positive({ error: 'Version must be a positive integer' }),
  description: z.string().optional(),
  artifacts: z.array(ArtifactSchema).min(1, { error: 'At least one artifact required' }),
  // Optional apply phase configuration (for schema-aware apply instructions)
  apply: ApplyPhaseSchema.optional(),
  // Optional format declaration; when absent, Markdown defaults apply
  format: FormatSchema.optional(),
});

// Derived TypeScript types
export type Artifact = z.infer<typeof ArtifactSchema>;
export type ApplyPhase = z.infer<typeof ApplyPhaseSchema>;
export type SchemaYaml = z.infer<typeof SchemaYamlSchema>;
export type FormatDeltaSection = z.infer<typeof FormatDeltaSectionSchema>;
export type FormatDeltaInline = z.infer<typeof FormatDeltaInlineSchema>;
export type FormatDelta = z.infer<typeof FormatDeltaSchema>;
export type SchemaFormat = z.infer<typeof FormatSchema>;

// Runtime state types (not Zod - internal only)

// Slice 1: Simple completion tracking via filesystem
export type CompletedSet = Set<string>;

// Return type for blocked query
export interface BlockedArtifacts {
  [artifactId: string]: string[];
}

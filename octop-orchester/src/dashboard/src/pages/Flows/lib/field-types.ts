/**
 * Field kinds a node can declare for its inspector form (ported from
 * Orchester lib/flows/field-types.ts). Labels, help and placeholders are not
 * stored here: they live in i18n under `flows.nodes.<id>.fields.<key>.*`.
 * Renderers are added together with the first node that needs each kind.
 */
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "key-value"
  | "json"
  | "code"
  | "agent-picker"
  | "kb-picker"
  | "integration-action"
  | "channel-picker"
  | "variable"
  | "duration"
  | "cron"
  | "string-list"
  | "spreadsheet"
  | "model-picker";

export interface FieldDef {
  /** Path inside `node.config`. */
  key: string;
  type: FieldType;
  required?: boolean;
  /** Hidden under "Advanced" in the inspector. */
  advanced?: boolean;
  /** Values for `select`; option labels are `flows.nodes.<id>.fields.<key>.options.<value>`. */
  options?: string[];
  /** Show this field only when another config key has the given value. */
  dependsOn?: { key: string; value: string };
}

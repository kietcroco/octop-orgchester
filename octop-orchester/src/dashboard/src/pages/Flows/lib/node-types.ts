/**
 * Single source of truth for flow engine node types (ported from Orchester
 * lib/flows/node-types.ts). Triggers share the `trigger` engine type and are
 * told apart by `config.triggerKind`.
 */
export const FLOW_NODE_TYPES = [
  "trigger",
  "agent",
  "kb_search",
  "generate_image",
  "embed_text",
  "llm_prompt",
  "generate_video",
  "text_to_speech",
  "transcribe",
  "rerank",
  "generate_avatar",
  "generate_music",
  "ocr_extract",
  "condition",
  "switch",
  "http",
  "integration",
  "transform",
  "spreadsheet",
  "delay",
  "notify",
  "code",
  "loop_for_each",
  "parallel",
  "try_catch",
  "subflow",
  "wait_human",
  "note",
  "end",
] as const;

export type FlowNodeType = (typeof FLOW_NODE_TYPES)[number];

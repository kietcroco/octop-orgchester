import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";

import { getNodeDef } from "../../lib/node-catalog";
import { iconFor } from "./icon-map";
import styles from "./nodes.module.less";

/** Accent of a node the catalog does not know (yet). */
const FALLBACK_ACCENT = "#8c8c8c";

/**
 * The canvas card for every node (Orchester: SimpleNode + RegistryNode). A node
 * missing from the catalog — e.g. a template step whose node is not built yet —
 * still renders, with a neutral icon, so a flow never fails to open.
 */
export function NodeCard({ type, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const node = data as {
    label?: string;
    nodeId?: string;
    config?: Record<string, unknown>;
  };
  const def = getNodeDef(String(node.nodeId ?? type ?? ""));
  const Icon = iconFor(def?.icon);
  const accent = def?.accent ?? FALLBACK_ACCENT;
  const note =
    type === "note" && typeof node.config?.text === "string"
      ? node.config.text
      : "";

  return (
    <div
      data-testid="node-card"
      data-known={def ? "true" : "false"}
      className={`${styles.card}${selected ? ` ${styles.selected}` : ""}`}
      style={{ borderLeftColor: accent }}
    >
      {type !== "trigger" && <Handle type="target" position={Position.Left} />}
      <span
        className={styles.iconBox}
        style={{ background: `${accent}1a`, color: accent }}
      >
        <Icon size={16} />
      </span>
      <div className={styles.text}>
        <div className={styles.label}>
          {node.label || t("flows.builder.unknownNode")}
        </div>
        {note && <div className={styles.sub}>{note}</div>}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default NodeCard;

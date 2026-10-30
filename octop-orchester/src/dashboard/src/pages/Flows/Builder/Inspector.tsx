import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "antd";
import type { Node } from "@xyflow/react";
import { Trash2 } from "lucide-react";

import { getNodeDef } from "../lib/node-catalog";
import styles from "./index.module.less";

export interface InspectorProps {
  node: Node | null;
  onChange: (node: Node) => void;
  onDelete: (id: string) => void;
  /**
   * Plug-in point for node tasks: returns the settings form of a cataloged node.
   * Never called for a node the catalog does not know.
   */
  renderFields?: (node: Node, onChange: (node: Node) => void) => ReactNode;
}

/** Right column: what the selected step is, its name, its settings (Orchester: InspectorForm). */
export function Inspector({
  node,
  onChange,
  onDelete,
  renderFields,
}: InspectorProps) {
  const { t } = useTranslation();

  if (!node) {
    return (
      <p className={styles.inspectorNote}>
        {t("flows.builder.inspectorEmpty")}
      </p>
    );
  }

  const data = (node.data ?? {}) as { nodeId?: string; label?: string };
  const def = getNodeDef(String(data.nodeId ?? node.type ?? ""));

  const rename = (label: string) =>
    onChange({ ...node, data: { ...node.data, label } });

  return (
    <div className={styles.inspectorBody}>
      <div className={styles.inspectorHead}>
        <div className={styles.inspectorHeadText}>
          <div className={styles.inspectorTitle}>
            {def ? t(`flows.nodes.${def.id}.title`) : String(node.type ?? "")}
          </div>
          {def && (
            <p className={styles.inspectorSummary}>
              {t(`flows.nodes.${def.id}.summary`)}
            </p>
          )}
        </div>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t("flows.builder.deleteNode")}
          onClick={() => onDelete(node.id)}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <label className={styles.inspectorLabel} htmlFor="flow-node-name">
        {t("flows.builder.nodeName")}
      </label>
      <Input
        id="flow-node-name"
        aria-label={t("flows.builder.nodeName")}
        value={String(data.label ?? "")}
        onChange={(event) => rename(event.target.value)}
      />

      <div className={styles.inspectorFields}>
        {def && renderFields ? (
          renderFields(node, onChange)
        ) : (
          <p className={styles.inspectorNote}>
            {t("flows.builder.noSettingsYet")}
          </p>
        )}
      </div>
    </div>
  );
}

export default Inspector;

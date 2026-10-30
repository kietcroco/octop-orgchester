import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "antd";
import { Search } from "lucide-react";

import {
  CATEGORY_ORDER,
  NODE_REGISTRY,
  listNodesByCategory,
  type NodeDef,
} from "../lib/node-catalog";
import { iconFor } from "./nodes/icon-map";
import styles from "./index.module.less";

export interface NodePaletteProps {
  onAdd: (nodeId: string) => void;
  /** Defaults to the real catalog; tests pass their own. */
  registry?: Record<string, NodeDef>;
}

/**
 * Left column: every cataloged node, grouped by category, with search. Items
 * can be clicked (adds after the selected step) or dragged onto the canvas
 * (Orchester: NodePalette). All categories are shown from the start; each one
 * fills up by itself as nodes are added to the catalog.
 */
export function NodePalette({
  onAdd,
  registry = NODE_REGISTRY,
}: NodePaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  // Every category is always listed, even before it has a node.
  const groups = useMemo(() => {
    const byCategory = listNodesByCategory(registry);
    return CATEGORY_ORDER.map((category) => ({
      category,
      nodes:
        byCategory.find((group) => group.category === category)?.nodes ?? [],
    }));
  }, [registry]);
  const needle = query.trim().toLowerCase();

  // While searching, only the categories with a match are shown.
  const visible = useMemo(() => {
    if (!needle) return groups;
    return groups
      .map((group) => ({
        category: group.category,
        nodes: group.nodes.filter(
          (def) =>
            t(`flows.nodes.${def.id}.title`).toLowerCase().includes(needle) ||
            t(`flows.nodes.${def.id}.summary`).toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.nodes.length > 0);
  }, [groups, needle, t]);

  return (
    <div className={styles.paletteInner}>
      <div className={styles.paletteSearch}>
        <Input
          allowClear
          prefix={<Search size={14} />}
          value={query}
          placeholder={t("flows.builder.paletteSearch")}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className={styles.paletteBody}>
        {visible.length === 0 ? (
          <p className={styles.paletteNote}>
            {t("flows.builder.paletteNoMatch")}
          </p>
        ) : (
          visible.map((group) => (
            <section
              key={group.category}
              className={styles.paletteGroup}
              data-testid={`palette-group-${group.category}`}
            >
              <div className={styles.paletteGroupHead}>
                <h3 className={styles.paletteGroupTitle}>
                  {t(`flows.categories.${group.category}`)}
                </h3>
                <span
                  className={styles.paletteCount}
                  data-testid={`palette-count-${group.category}`}
                >
                  {group.nodes.length}
                </span>
              </div>
              {group.nodes.length === 0 && (
                <p className={styles.paletteGroupEmpty}>
                  {t("flows.builder.groupEmpty")}
                </p>
              )}
              {group.nodes.map((def) => {
                const Icon = iconFor(def.icon);
                return (
                  <button
                    key={def.id}
                    type="button"
                    draggable
                    className={styles.paletteItem}
                    title={t(`flows.nodes.${def.id}.summary`)}
                    onClick={() => onAdd(def.id)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "application/flow-node",
                        def.id,
                      );
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <span
                      className={styles.paletteIcon}
                      style={{
                        background: `${def.accent}1a`,
                        color: def.accent,
                      }}
                    >
                      <Icon size={14} />
                    </span>
                    <span className={styles.paletteText}>
                      <span className={styles.paletteName}>
                        {t(`flows.nodes.${def.id}.title`)}
                      </span>
                      <span className={styles.paletteDesc}>
                        {t(`flows.nodes.${def.id}.summary`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

export default NodePalette;

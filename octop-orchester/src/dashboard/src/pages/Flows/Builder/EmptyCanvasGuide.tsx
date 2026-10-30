import { useTranslation } from "react-i18next";

import { FLOW_TEMPLATES, type BuiltFlowTemplate } from "../lib/templates";
import { listNodesByCategory } from "../lib/node-catalog";
import styles from "./index.module.less";

export interface EmptyCanvasGuideProps {
  onAddNode: (nodeId: string) => void;
  onApplyTemplate: (template: BuiltFlowTemplate) => void;
}

/** Shown over an empty canvas: start from a template or from a trigger (Orchester: EmptyCanvasGuide). */
export function EmptyCanvasGuide({
  onAddNode,
  onApplyTemplate,
}: EmptyCanvasGuideProps) {
  const { t } = useTranslation();
  const triggers =
    listNodesByCategory().find((group) => group.category === "trigger")
      ?.nodes ?? [];

  return (
    <div className={styles.guideWrap}>
      <div className={styles.guide} data-testid="empty-canvas-guide">
        <h3 className={styles.guideTitle}>{t("flows.builder.emptyTitle")}</h3>
        <p className={styles.guideHint}>{t("flows.builder.emptyHint")}</p>

        <h4 className={styles.guideSection}>
          {t("flows.builder.templatesTitle")}
        </h4>
        <div className={styles.guideGrid}>
          {FLOW_TEMPLATES.filter((template) => template.id !== "blank").map(
            (template) => {
              const built = template.build(t);
              return (
                <button
                  key={template.id}
                  type="button"
                  className={styles.guideCard}
                  onClick={() => onApplyTemplate(built)}
                >
                  <span className={styles.guideCardName}>{built.name}</span>
                  <span className={styles.guideCardDesc}>
                    {built.description}
                  </span>
                </button>
              );
            },
          )}
        </div>

        {triggers.length > 0 && (
          <>
            <h4 className={styles.guideSection}>
              {t("flows.builder.startersTitle")}
            </h4>
            <div className={styles.guideRow}>
              {triggers.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  className={styles.guideChip}
                  onClick={() => onAddNode(def.id)}
                >
                  {t(`flows.nodes.${def.id}.title`)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

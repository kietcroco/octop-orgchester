import { useTranslation } from "react-i18next";
import { Tooltip } from "antd";
import { Pencil, Trash2 } from "lucide-react";

import { message } from "@/utils/antdMessage";
import { modal } from "@/utils/antdModal";
import { isCuratedPalette, PALETTE_SWATCH } from "../../../styles/themePalettes";
import { ExpertIcon } from "../../Experts/components/iconForName";
import { deleteAgency, type AgencySummary } from "../../../api/modules/agency";
import styles from "../index.module.less";

/**
 * Agency colors are stored as either a curated palette key (from
 * ExpertColorPicker) or a hex string — resolve the key to its swatch.
 */
export function agencySwatchColor(color?: string | null): string {
  if (!color) return "var(--fn-color-brand)";
  return isCuratedPalette(color) ? PALETTE_SWATCH[color] : color;
}

export interface AgencyCardProps {
  agency: AgencySummary;
  onOpen: (agencyId: string) => void;
  onEdit: (agency: AgencySummary) => void;
  onDeleted: (agencyId: string) => void;
}

export function AgencyCard({
  agency,
  onOpen,
  onEdit,
  onDeleted,
}: AgencyCardProps) {
  const { t } = useTranslation();

  const confirmDelete = () => {
    modal.confirm({
      title: t("agencies.deleteConfirm"),
      content: t("agencies.deleteConfirmDesc"),
      okText: t("agencies.delete"),
      cancelText: t("agencies.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteAgency(agency.agency_id);
          onDeleted(agency.agency_id);
        } catch {
          message.error(t("agencies.deleteFailed"));
          throw new Error("agency delete failed");
        }
      },
    });
  };

  return (
    <div className={styles.card} onClick={() => onOpen(agency.agency_id)}>
      <div className={styles.cardHeader}>
        <span
          className={styles.cardAvatar}
          style={{ background: agencySwatchColor(agency.color) }}
          aria-hidden
        >
          <ExpertIcon iconName={agency.icon_name} size={18} />
        </span>
        {/* Real button so the card is keyboard-reachable without nesting
            interactive elements inside a role="button" wrapper. */}
        <button
          type="button"
          className={styles.cardTitle}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(agency.agency_id);
          }}
        >
          {agency.name}
        </button>
        <div
          className={styles.cardActions}
          onClick={(event) => event.stopPropagation()}
        >
          <Tooltip title={t("agencies.editTitle")} mouseEnterDelay={0.4}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={t("agencies.editTitle")}
              onClick={() => onEdit(agency)}
            >
              <Pencil size={13} />
            </button>
          </Tooltip>
          <Tooltip title={t("agencies.delete")} mouseEnterDelay={0.4}>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
              aria-label={t("agencies.delete")}
              onClick={confirmDelete}
            >
              <Trash2 size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      <p className={styles.cardDesc}>{agency.description || " "}</p>

      <div className={styles.cardMeta}>
        {agency.agent_count} {t("agencies.agentCount")} ·{" "}
        {agency.channel_count} {t("agencies.channelCount")}
      </div>
    </div>
  );
}

export default AgencyCard;

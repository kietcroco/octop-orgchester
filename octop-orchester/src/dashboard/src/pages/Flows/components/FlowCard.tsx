import { useTranslation } from "react-i18next";
import { Dropdown, Tag } from "antd";
import type { MenuProps } from "antd";
import { MoreHorizontal } from "lucide-react";

import { message } from "@/utils/antdMessage";
import { modal } from "@/utils/antdModal";
import {
  flowApi,
  type FlowStatus,
  type FlowSummary,
} from "../../../api/modules/flows";
import styles from "../index.module.less";

export const STATUS_TAG_COLOR: Record<FlowStatus, string> = {
  active: "success",
  paused: "warning",
  draft: "default",
};

const STATUS_ACTION_KEY: Record<FlowStatus, string> = {
  active: "setActive",
  paused: "setPaused",
  draft: "setDraft",
};

const STATUS_ORDER: readonly FlowStatus[] = ["active", "paused", "draft"];

export function formatUpdatedAt(iso: string, language: string): string {
  const date = new Date(iso);
  try {
    return new Intl.DateTimeFormat(language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export interface FlowCardProps {
  flow: FlowSummary;
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: FlowStatus) => void;
  onDeleted: (id: string) => void;
}

export function FlowCard({
  flow,
  onOpen,
  onStatusChange,
  onDeleted,
}: FlowCardProps) {
  const { t, i18n } = useTranslation();

  const changeStatus = async (status: FlowStatus) => {
    try {
      await flowApi.update(flow.id, { status });
      onStatusChange(flow.id, status);
    } catch {
      message.error(t("flows.statusFailed"));
    }
  };

  const confirmDelete = () => {
    modal.confirm({
      title: t("flows.deleteConfirm"),
      content: t("flows.deleteConfirmDesc"),
      okText: t("flows.delete"),
      cancelText: t("flows.cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await flowApi.remove(flow.id);
          onDeleted(flow.id);
        } catch {
          message.error(t("flows.deleteFailed"));
          throw new Error("flow delete failed");
        }
      },
    });
  };

  const items: MenuProps["items"] = [
    ...STATUS_ORDER.filter((status) => status !== flow.status).map(
      (status) => ({
        key: status,
        label: t(`flows.actions.${STATUS_ACTION_KEY[status]}`),
      }),
    ),
    { type: "divider" },
    { key: "delete", label: t("flows.delete"), danger: true },
  ];

  const onMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "delete") confirmDelete();
    else void changeStatus(key as FlowStatus);
  };

  return (
    <div className={styles.card} onClick={() => onOpen(flow.id)}>
      <div className={styles.cardHeader}>
        {/* Real button so the card is keyboard-reachable without nesting
            interactive elements inside a role="button" wrapper. */}
        <button
          type="button"
          className={styles.cardTitle}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(flow.id);
          }}
        >
          {flow.name}
        </button>
        <Tag
          color={STATUS_TAG_COLOR[flow.status]}
          style={{ marginInlineEnd: 0 }}
        >
          {t(`flows.status.${flow.status}`)}
        </Tag>
        <div
          className={styles.cardActions}
          onClick={(event) => event.stopPropagation()}
        >
          <Dropdown trigger={["click"]} menu={{ items, onClick: onMenuClick }}>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={t("flows.actions.more")}
            >
              <MoreHorizontal size={14} />
            </button>
          </Dropdown>
        </div>
      </div>

      <p className={styles.cardDesc}>{flow.description || " "}</p>

      <div className={styles.cardMeta}>
        {flow.nodeCount} {t("flows.stepCount")} · {t("flows.updatedAt")}{" "}
        {formatUpdatedAt(flow.updatedAt, i18n.language)}
      </div>
    </div>
  );
}

export default FlowCard;

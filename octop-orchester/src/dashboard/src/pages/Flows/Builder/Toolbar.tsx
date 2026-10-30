import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select, Tooltip } from "antd";
import { ArrowLeft, Loader2, Play, Save } from "lucide-react";

import type { FlowStatus } from "../../../api/modules/flows";
import styles from "./index.module.less";

const STATUSES: readonly FlowStatus[] = ["active", "paused", "draft"];

export interface ToolbarProps {
  name: string;
  onNameChange: (value: string) => void;
  status: FlowStatus;
  onStatusChange: (value: FlowStatus) => void;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onBack: () => void;
  /** Slot for builder actions added by later tasks (undo, redo, tidy, review…). */
  actions?: ReactNode;
}

/** Top bar of the builder, laid out like Orchester's FlowBuilder header. */
export function Toolbar({
  name,
  onNameChange,
  status,
  onStatusChange,
  saving,
  canSave,
  onSave,
  onBack,
  actions,
}: ToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={t("flows.builder.back")}
          onClick={onBack}
        >
          <ArrowLeft size={16} />
        </button>
        <Input
          className={styles.nameInput}
          variant="borderless"
          maxLength={64}
          value={name}
          aria-label={t("flows.builder.nameLabel")}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <Select
          className={styles.statusSelect}
          size="small"
          value={status}
          aria-label={t("flows.builder.statusLabel")}
          onChange={onStatusChange}
          options={STATUSES.map((value) => ({
            value,
            label: t(`flows.status.${value}`),
          }))}
        />
      </div>
      <div className={styles.toolbarRight}>
        {actions}
        <Button
          icon={
            saving ? (
              <Loader2 size={14} className={styles.spin} />
            ) : (
              <Save size={14} />
            )
          }
          disabled={!canSave}
          onClick={onSave}
        >
          {t("flows.builder.save")}
        </Button>
        <Tooltip title={t("flows.builder.runDisabled")}>
          <span data-testid="builder-run-wrapper">
            <Button type="primary" icon={<Play size={14} />} disabled>
              {t("flows.builder.run")}
            </Button>
          </span>
        </Tooltip>
      </div>
    </div>
  );
}

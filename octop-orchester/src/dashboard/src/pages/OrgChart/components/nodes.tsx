import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";

import {
  isCuratedPalette,
  PALETTE_SWATCH,
} from "../../../styles/themePalettes";
import { ExpertIcon } from "../../Experts/components/iconForName";
import type {
  OrgAgentMeta,
  OrgChannel,
  OrgAgencyMeta,
  OrgRootMeta,
} from "../../../api/modules/orgChart";
import styles from "../index.module.less";

export function swatch(color?: string | null): string {
  if (!color) return "var(--fn-color-brand)";
  return isCuratedPalette(color) ? PALETTE_SWATCH[color] : color;
}

function RootNodeView({ data }: NodeProps) {
  const { t } = useTranslation();
  const meta = data.meta as OrgRootMeta;
  return (
    <div className={`${styles.node} ${styles.rootNode}`}>
      <div className={styles.nodeTitle}>{t("org.node.organization")}</div>
      <div className={styles.rootStats}>
        <span>{t("org.summary.agencies")} {meta.agencyCount}</span>
        <span>{t("org.summary.agents")} {meta.agentCount}</span>
        <span>{t("org.summary.teams")} {meta.teamCount}</span>
        <span>{t("org.summary.channels")} {meta.channelCount}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}

function AgencyNodeView({ data }: NodeProps) {
  const { t } = useTranslation();
  const meta = data.meta as OrgAgencyMeta;
  const name = String(data.label ?? "");
  return (
    <div
      className={`${styles.node} ${styles.agencyNode}`}
      style={{ borderColor: meta.unassigned ? undefined : swatch(meta.color) }}
    >
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.nodeHead}>
        {meta.unassigned ? (
          <span className={styles.agencyBadge}>
            {t("org.node.unassigned")}
          </span>
        ) : (
          <ExpertIcon iconName={meta.iconName} size={18} />
        )}
        <span className={styles.nodeTitle}>
          {meta.unassigned ? t("org.node.unassigned") : name}
        </span>
      </div>
      {!meta.unassigned && meta.description ? (
        <div className={styles.nodeDesc}>{meta.description}</div>
      ) : null}
      <div className={styles.nodeMeta}>
        <span>{meta.agentCount} {t("org.node.agent")}</span>
        {meta.activeCount > 0 ? (
          <span className={styles.live}>{meta.activeCount} · {t("org.summary.agentsActive")}</span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}

function AgentNodeView({ data }: NodeProps) {
  const { t } = useTranslation();
  const meta = data.meta as OrgAgentMeta;
  const name = String(data.label ?? "");
  const running = meta.state === "running";
  return (
    <div
      className={`${styles.node} ${styles.agentNode} ${running ? styles.agentRunning : ""}`}
      style={{ borderColor: swatch(meta.color) }}
    >
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.nodeHead}>
        <ExpertIcon iconName={meta.iconName} size={16} />
        <span className={styles.nodeTitle}>{name}</span>
        {meta.kind === "team" ? (
          <span className={styles.tag}>{t("org.node.teamHost")}</span>
        ) : meta.teamMember ? (
          <span className={styles.tag}>{t("org.node.team")}</span>
        ) : null}
      </div>
      {meta.description ? <div className={styles.nodeDesc}>{meta.description}</div> : null}
      <div className={styles.nodeMeta}>
        <span className={styles.model}>{meta.model ?? t("org.node.noModel")}</span>
        {meta.channelCount > 0 ? (
          <span className={styles.channelBadge} title={
            meta.channels.map((c: OrgChannel) => c.name).join(", ")
          }>
            {t("org.node.channels")} {meta.channelCount}
          </span>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={styles.handle}
        isConnectable={false}
      />
    </div>
  );
}

export const RootNode = memo(RootNodeView);
export const AgencyNode = memo(AgencyNodeView);
export const AgentNode = memo(AgentNodeView);

export const nodeTypes = {
  root: RootNode,
  agency: AgencyNode,
  agent: AgentNode,
};

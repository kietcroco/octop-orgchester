import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Select, Tooltip } from "antd";
import { Plus, X } from "lucide-react";

import { message } from "@/utils/antdMessage";
import { formatAgentState } from "@/utils/agentError";
import { useAgent } from "../../../context/AgentContext";
import {
  setAgencyMembers,
  type AgencyAgent,
  type AgencyDetail,
} from "../../../api/modules/agency";
import { ExpertIcon } from "../../Experts/components/iconForName";
import { agencySwatchColor } from "./AgencyCard";
import styles from "../index.module.less";

export interface AgencyAgentListProps {
  agency: AgencyDetail;
  onChanged: (next: AgencyDetail) => void;
}

export function AgencyAgentList({ agency, onChanged }: AgencyAgentListProps) {
  const { t } = useTranslation();
  const { agents } = useAgent();
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<string[] | null>(null);

  const memberIds = useMemo(
    () => agency.agents.map((agent) => agent.agent_id),
    [agency.agents],
  );

  const candidates = useMemo(
    () =>
      agents
        .filter(
          (agent) => agent.kind !== "team" && !memberIds.includes(agent.agent_id),
        )
        .map((agent) => ({ value: agent.agent_id, label: agent.name })),
    [agents, memberIds],
  );

  const persist = async (nextIds: string[]) => {
    setSaving(true);
    try {
      onChanged(await setAgencyMembers(agency.agency_id, nextIds));
      setAdded(null);
    } catch {
      message.error(t("agencies.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const addSelected = async () => {
    if (!added || added.length === 0) return;
    await persist([...memberIds, ...added]);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>{t("agencies.agents")}</div>

      {agency.agents.length === 0 ? (
        <div className={styles.panelEmpty}>{t("agencies.noAgents")}</div>
      ) : (
        <div className={styles.memberList}>
          {agency.agents.map((agent: AgencyAgent) => (
            <div key={agent.agent_id} className={styles.memberRow}>
              <span
                className={styles.cardAvatar}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: agent.color
                    ? agencySwatchColor(agent.color)
                    : "var(--fn-bg-secondary)",
                  color: agent.color ? "#fff" : "var(--fn-text-secondary)",
                }}
                aria-hidden
              >
                <ExpertIcon iconName={agent.icon_name} size={15} />
              </span>
              <div className={styles.memberBody}>
                <div className={styles.memberName}>{agent.name}</div>
                <div className={styles.memberMeta}>
                  {agent.default_model || "—"}
                  {agent.state ? ` · ${formatAgentState(agent.state, t)}` : ""}
                </div>
              </div>
              <Tooltip title={t("agencies.removeAgent")} mouseEnterDelay={0.4}>
                <Button
                  type="text"
                  size="small"
                  className={styles.memberRemove}
                  aria-label={t("agencies.removeAgent")}
                  disabled={saving}
                  icon={<X size={13} />}
                  onClick={() =>
                    void persist(
                      memberIds.filter((id) => id !== agent.agent_id),
                    )
                  }
                />
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      <div className={styles.addRow}>
        <Select
          className={styles.addSelect}
          mode="multiple"
          allowClear
          showSearch
          optionFilterProp="label"
          disabled={saving || candidates.length === 0}
          value={added ?? []}
          options={candidates}
          placeholder={t("agencies.addAgents")}
          onChange={(value: string[]) => setAdded(value)}
        />
        <Button
          type="primary"
          icon={<Plus size={13} />}
          loading={saving}
          disabled={!added || added.length === 0}
          onClick={() => void addSelected()}
        >
          {t("agencies.addAgents")}
        </Button>
      </div>
    </div>
  );
}

export default AgencyAgentList;

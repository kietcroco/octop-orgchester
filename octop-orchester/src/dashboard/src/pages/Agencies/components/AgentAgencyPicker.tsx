import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "antd";

import { message } from "@/utils/antdMessage";
import {
  getAgentAgencies,
  listAgencies,
  setAgentAgencies,
  type AgencySummary,
} from "../../../api/modules/agency";
import styles from "../index.module.less";

export interface AgentAgencyPickerProps {
  agentId: string;
}

/** Drop-in section for the agent edit drawer: which agencies this agent is in. */
export function AgentAgencyPicker({ agentId }: AgentAgencyPickerProps) {
  const { t } = useTranslation();
  const [agencies, setAgencies] = useState<AgencySummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listAgencies(), getAgentAgencies(agentId)])
      .then(([all, mine]) => {
        if (cancelled) return;
        setAgencies(all);
        setSelected(mine.agency_ids);
      })
      .catch(() => {
        if (!cancelled) message.error(t("agencies.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, t]);

  const options = useMemo(
    () => agencies.map((item) => ({ value: item.agency_id, label: item.name })),
    [agencies],
  );

  const save = async (next: string[]) => {
    const previous = selected;
    setSelected(next);
    setSaving(true);
    try {
      const result = await setAgentAgencies(agentId, next);
      setSelected(result.agency_ids);
    } catch {
      setSelected(previous);
      message.error(t("agencies.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.picker}>
      <span className={styles.pickerLabel}>{t("agencies.agentAgencies")}</span>
      <Select
        mode="multiple"
        allowClear
        showSearch
        optionFilterProp="label"
        loading={loading}
        disabled={loading || saving}
        value={selected}
        options={options}
        placeholder={t("agencies.agentAgenciesPlaceholder")}
        onChange={(value: string[]) => void save(value)}
      />
    </div>
  );
}

export default AgentAgencyPicker;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Input, Spin } from "antd";
import { Plus, Search } from "lucide-react";

import { message } from "@/utils/antdMessage";
import PageShell from "../../layouts/PageShell";
import { EmptyState } from "../../components/EmptyState";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  flowApi,
  type FlowStatus,
  type FlowSummary,
} from "../../api/modules/flows";
import { FlowBuilder } from "./Builder";
import { CreateFlowModal } from "./components/CreateFlowModal";
import { FlowCard } from "./components/FlowCard";
import { groupFlowsByStatus } from "./lib/group-by-status";
import styles from "./index.module.less";

/**
 * Route component for both `/flows` and `/flows/:flowId`:
 * no id in the URL → the list, id present → the builder (full height, with its
 * own toolbar instead of the page shell).
 */
export default function FlowsPage() {
  const { t } = useTranslation();
  const { flowId } = useParams<{ flowId?: string }>();

  if (flowId) return <FlowBuilder key={flowId} flowId={flowId} />;

  return (
    <PageShell title={t("flows.title")} subtitle={t("flows.subtitle")}>
      <FlowListView />
    </PageShell>
  );
}

/* ── List ─────────────────────────────────────────────────────── */

function FlowListView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [flows, setFlows] = useState<FlowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // Read the latest `t` without making `load` (and its effect) depend on it.
  const tRef = useRef(t);
  tRef.current = t;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFlows(await flowApi.list());
    } catch {
      message.error(tRef.current("flows.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      needle
        ? flows.filter((flow) => flow.name.toLowerCase().includes(needle))
        : flows,
    [flows, needle],
  );
  const groups = useMemo(() => groupFlowsByStatus(visible), [visible]);

  const setStatus = (id: string, status: FlowStatus) =>
    setFlows((prev) =>
      prev.map((flow) => (flow.id === id ? { ...flow, status } : flow)),
    );

  return (
    <>
      <div className={styles.toolbar}>
        <Input
          className={styles.toolbarSearch}
          prefix={<Search size={14} />}
          allowClear
          value={query}
          placeholder={t("flows.searchPlaceholder")}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => setCreateOpen(true)}
        >
          {t("flows.create")}
        </Button>
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <Spin />
        </div>
      ) : flows.length === 0 ? (
        <EmptyState
          variant="mascot"
          title={t("flows.empty")}
          description={t("flows.emptyHint")}
          actionLabel={t("flows.create")}
          onAction={() => setCreateOpen(true)}
        />
      ) : visible.length === 0 ? (
        <div className={styles.searchEmpty}>{t("flows.empty")}</div>
      ) : (
        groups.map((group) => (
          <section key={group.status} className={styles.group}>
            <h2 className={styles.groupHeader}>
              {t(`flows.status.${group.status}`)}
              <span className={styles.groupCount}>{group.flows.length}</span>
            </h2>
            <div
              className={`${styles.grid}${
                isMobile ? ` ${styles.gridMobile}` : ""
              }`}
            >
              {group.flows.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  onOpen={(id) => navigate(`/flows/${encodeURIComponent(id)}`)}
                  onStatusChange={setStatus}
                  onDeleted={(id) =>
                    setFlows((prev) => prev.filter((item) => item.id !== id))
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}

      <CreateFlowModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(flow) => {
          message.success(t("flows.created"));
          setCreateOpen(false);
          navigate(`/flows/${encodeURIComponent(flow.id)}`);
        }}
      />
    </>
  );
}

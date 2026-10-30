import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Input, Spin } from "antd";
import { ArrowLeft, Pencil, Plus, Search } from "lucide-react";

import { message } from "@/utils/antdMessage";
import PageShell from "../../layouts/PageShell";
import { EmptyState } from "../../components/EmptyState";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  getAgency,
  listAgencies,
  type AgencyDetail,
  type AgencySummary,
} from "../../api/modules/agency";
import { ExpertIcon } from "../Experts/components/iconForName";
import { AgencyCard, agencySwatchColor } from "./components/AgencyCard";
import { AgencyFormModal } from "./components/AgencyFormModal";
import { AgencyAgentList } from "./components/AgencyAgentList";
import { AgencyChannelList } from "./components/AgencyChannelList";
import styles from "./index.module.less";

/**
 * Route component for both `/agencies` and `/agencies/:agencyId`:
 * no id in the URL → list view, id present → detail view.
 */
export default function AgenciesPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { agencyId } = useParams<{ agencyId?: string }>();

  return (
    <PageShell title={t("agencies.title")} subtitle={t("agencies.subtitle")}>
      {agencyId ? (
        <AgencyDetailView key={agencyId} agencyId={agencyId} />
      ) : (
        <AgencyListView isMobile={isMobile} />
      )}
    </PageShell>
  );
}

/* ── List ─────────────────────────────────────────────────────── */

function AgencyListView({ isMobile }: { isMobile: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<AgencySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgencySummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAgencies(await listAgencies());
    } catch {
      message.error(t("agencies.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      needle
        ? agencies.filter((agency) => agency.name.toLowerCase().includes(needle))
        : agencies,
    [agencies, needle],
  );

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <>
      <div className={styles.toolbar}>
        <Input
          className={styles.toolbarSearch}
          prefix={<Search size={14} />}
          allowClear
          value={query}
          placeholder={t("agencies.searchPlaceholder")}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => setFormOpen(true)}
        >
          {t("agencies.create")}
        </Button>
      </div>

      {loading ? (
        <div className={styles.loadingState}>
          <Spin />
        </div>
      ) : agencies.length === 0 ? (
        <EmptyState
          variant="mascot"
          title={t("agencies.empty")}
          description={t("agencies.emptyHint")}
        />
      ) : visible.length === 0 ? (
        <div className={styles.searchEmpty}>{t("agencies.empty")}</div>
      ) : (
        <div
          className={`${styles.grid}${isMobile ? ` ${styles.gridMobile}` : ""}`}
        >
          {visible.map((agency) => (
            <AgencyCard
              key={agency.agency_id}
              agency={agency}
              onOpen={(id) => navigate(`/agencies/${encodeURIComponent(id)}`)}
              onEdit={setEditing}
              onDeleted={(id) =>
                setAgencies((prev) =>
                  prev.filter((item) => item.agency_id !== id),
                )
              }
            />
          ))}
        </div>
      )}

      <AgencyFormModal
        open={formOpen || editing !== null}
        mode={editing ? "edit" : "create"}
        initial={editing}
        onClose={closeForm}
        onSaved={(saved) => {
          setAgencies((prev) => {
            const exists = prev.some(
              (item) => item.agency_id === saved.agency_id,
            );
            return exists
              ? prev.map((item) =>
                  item.agency_id === saved.agency_id ? saved : item,
                )
              : [saved, ...prev];
          });
          closeForm();
        }}
      />
    </>
  );
}

/* ── Detail ───────────────────────────────────────────────────── */

function AgencyDetailView({ agencyId }: { agencyId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agency, setAgency] = useState<AgencyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAgency(await getAgency(agencyId));
    } catch {
      message.error(t("agencies.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [agencyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.detail}>
      <button
        type="button"
        className={styles.backLink}
        onClick={() => navigate("/agencies")}
      >
        <ArrowLeft size={14} />
        {t("agencies.back")}
      </button>

      {loading ? (
        <div className={styles.loadingState}>
          <Spin />
        </div>
      ) : !agency ? (
        <EmptyState
          variant="mascot"
          title={t("agencies.empty")}
          description={t("agencies.emptyHint")}
        />
      ) : (
        <>
          <div className={styles.detailHeader}>
            <span
              className={styles.detailAvatar}
              style={{ background: agencySwatchColor(agency.color) }}
              aria-hidden
            >
              <ExpertIcon iconName={agency.icon_name} size={22} />
            </span>
            <div className={styles.detailTitleBlock}>
              <div className={styles.detailName}>{agency.name}</div>
              {agency.description && (
                <p className={styles.detailDesc}>{agency.description}</p>
              )}
            </div>
            <div className={styles.detailActions}>
              <Button
                icon={<Pencil size={13} />}
                onClick={() => setEditOpen(true)}
              >
                {t("agencies.editTitle")}
              </Button>
            </div>
          </div>

          <div className={styles.counters}>
            <span className={styles.counter}>
              <span className={styles.counterValue}>
                {agency.agent_count}
              </span>
              {t("agencies.agentCount")}
            </span>
            <span className={styles.counter}>
              <span className={styles.counterValue}>
                {agency.channel_count}
              </span>
              {t("agencies.channelCount")}
            </span>
          </div>

          <div className={styles.columns}>
            <AgencyAgentList agency={agency} onChanged={setAgency} />
            <AgencyChannelList channels={agency.channels} />
          </div>
        </>
      )}

      <AgencyFormModal
        open={editOpen}
        mode="edit"
        initial={agency}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setAgency((prev) => (prev ? { ...prev, ...saved } : prev));
          setEditOpen(false);
        }}
      />
    </div>
  );
}

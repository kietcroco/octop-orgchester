import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button, Input, Spin } from "antd";
import { Maximize2, RotateCcw, Search } from "lucide-react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { message } from "@/utils/antdMessage";
import PageShell from "../../layouts/PageShell";
import { EmptyState } from "../../components/EmptyState";
import { getOrgGraph, type OrgGraph } from "../../api/modules/orgChart";
import { layoutNodes, type OrgLayoutNode } from "./layout";
import { nodeTypes } from "./components/nodes";
import styles from "./index.module.less";

const POSITIONS_KEY = "octop:org:positions";
const POLL_MS = 15000;
const PERSIST_MS = 250;

type StoredPositions = Record<string, { x: number; y: number }>;

function readPositions(): StoredPositions {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as StoredPositions) : {};
  } catch {
    return {};
  }
}

function writePositions(value: StoredPositions): void {
  try {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(value));
  } catch {
    // private window / blocked storage — the chart just does not remember.
  }
}

/** Ancestors of every match, so a hit is never shown floating away from its branch. */
function filterWithAncestors<T extends { source: string; target: string }>(
  nodes: Node[],
  edges: T[],
  query: string,
): Set<string> {
  const q = query.trim().toLowerCase();
  if (!q) return new Set(nodes.map((n) => n.id));
  const keep = new Set<string>();
  for (const node of nodes) {
    const label = String((node.data as { label?: string }).label ?? "").toLowerCase();
    if (label.includes(q)) keep.add(node.id);
  }
  // Walk up the edge direction until nothing new is added.
  let grew = true;
  while (grew) {
    grew = false;
    for (const edge of edges) {
      if (keep.has(edge.target) && !keep.has(edge.source)) {
        keep.add(edge.source);
        grew = true;
      }
    }
  }
  return keep;
}

export default function OrgChartPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [graph, setGraph] = useState<OrgGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const movedRef = useRef<StoredPositions | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      setGraph(await getOrgGraph());
    } catch {
      message.error(t("org.loadFailed"));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load(true);
    const id = window.setInterval(() => void load(false), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const built = useMemo(() => {
    if (!graph) return { nodes: [] as OrgLayoutNode[], edges: [] as Edge[] };
    const laid = layoutNodes(graph.nodes, graph.edges);
    const stored = movedRef.current ?? readPositions();
    const positioned = laid.map((node) => ({
      ...node,
      position: stored[node.id] ?? node.position,
    }));
    const flowEdges: Edge[] = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: Boolean(edge.animated),
      label: edge.label,
      type: "bezier",
      className: edge.kind === "team-agent" ? styles.teamEdge : undefined,
      style: { strokeDasharray: edge.kind === "team-agent" ? "5 4" : undefined },
    }));
    return { nodes: positioned, edges: flowEdges };
  }, [graph]);

  useEffect(() => {
    if (!graph) return;
    const keep = filterWithAncestors(built.nodes, built.edges, query);
    setNodes(
      built.nodes
        .filter((node) => keep.has(node.id))
        .map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
          draggable: node.type !== "root",
        })),
    );
    setEdges(built.edges.filter((e) => keep.has(e.source) && keep.has(e.target)));
  }, [built, graph, query, setNodes, setEdges]);

  const persist = useCallback((next: Node[]) => {
    const existing = movedRef.current ?? readPositions();
    for (const node of next) {
      existing[node.id] = { x: node.position.x, y: node.position.y };
    }
    movedRef.current = existing;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => writePositions(existing), PERSIST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const resetLayout = useCallback(() => {
    movedRef.current = {};
    writePositions({});
    try {
      localStorage.removeItem(POSITIONS_KEY);
    } catch {
      // ignore — writePositions already cleared the remembered set
    }
    if (!graph) return;
    setNodes(
      layoutNodes(graph.nodes, graph.edges).map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        draggable: node.type !== "root",
      })),
    );
  }, [graph, setNodes]);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const [kind, ...rest] = node.id.split(":");
      const id = rest.join(":");
      if (kind === "agency") {
        if (id === "__unassigned__") navigate("/agencies");
        else navigate(`/agencies/${encodeURIComponent(id)}`);
      } else if (kind === "agent") {
        navigate(`/experts?agent=${encodeURIComponent(id)}`);
      }
    },
    [navigate],
  );

  const summary = graph?.summary;
  const isEmpty =
    !loading && (!summary || (summary.agencies === 0 && summary.agents === 0));

  return (
    <PageShell
      title={t("org.title")}
      subtitle={t("org.subtitle")}
      actions={
        <Button
          icon={<RotateCcw size={16} />}
          onClick={resetLayout}
          title={t("org.resetLayoutTitle")}
        >
          {t("org.resetLayout")}
        </Button>
      }
    >
      <div className={styles.wrap}>
        <div className={styles.toolbar}>
          <Input
            allowClear
            className={styles.search}
            prefix={<Search size={15} />}
            placeholder={t("org.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {summary ? (
            <div className={styles.summary}>
              <span>{t("org.summary.agencies")} {summary.agencies}</span>
              <span>{t("org.summary.agents")} {summary.agents}</span>
              <span>{t("org.summary.agentsActive")} {summary.activeAgents}</span>
              <span>{t("org.summary.teams")} {summary.teams}</span>
              <span>{t("org.summary.channels")} {summary.channels}</span>
              <Maximize2 size={14} className={styles.summaryIcon} />
            </div>
          ) : null}
        </div>

        <div className={styles.canvas}>
          {loading ? (
            <div className={styles.center}>
              <Spin />
            </div>
          ) : isEmpty ? (
            <div className={styles.center}>
              <EmptyState
                variant="mascot"
                title={t("org.empty")}
                description={t("org.emptyHint")}
                actionLabel={t("org.createFirstAgency")}
                onAction={() => navigate("/agencies")}
              />
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeDragStop={(_, __, dragged) => persist(dragged)}
              nodesConnectable={false}
              elementsSelectable={false}
              fitView
              minZoom={0.2}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          )}
        </div>
      </div>
    </PageShell>
  );
}

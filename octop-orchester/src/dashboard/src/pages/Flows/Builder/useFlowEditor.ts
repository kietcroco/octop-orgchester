import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Edge,
  type Node,
} from "@xyflow/react";

import { message } from "@/utils/antdMessage";
import {
  flowApi,
  newId,
  type FlowDTO,
  type FlowStatus,
} from "../../../api/modules/flows";
import { addNodeToGraph, connect, removeNode, type Graph } from "../lib/graph";
import { getNodeDef } from "../lib/node-catalog";
import { toCanvasEdges, toCanvasNodes } from "../lib/node-mapping";
import { normalizeFlowEdges, normalizeFlowNodes } from "../lib/normalize";
import { buildFlowPayload } from "../lib/payload";
import type { BuiltFlowTemplate } from "../lib/templates";

export interface FlowEditor {
  flow: FlowDTO | null;
  loading: boolean;
  notFound: boolean;
  name: string;
  setName: (value: string) => void;
  status: FlowStatus;
  /** Saves the new status straight away; reverts it if the save fails. */
  setStatus: (value: FlowStatus) => void;
  saving: boolean;
  canSave: boolean;
  save: () => Promise<boolean>;

  nodes: Node[];
  edges: Edge[];
  selectedId: string | null;
  select: (id: string | null) => void;
  /** Adds a cataloged node; unknown ids are ignored. Chains from the selected step unless dropped at a position. */
  addNode: (nodeId: string, at?: { x: number; y: number }) => void;
  deleteNode: (id: string) => void;
  /** Replaces the node that has the same id (rename, settings…). */
  updateNode: (node: Node) => void;
  /** Replaces the whole graph with a template's steps. */
  applyTemplate: (template: BuiltFlowTemplate) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
}

/** State and actions of the flow builder; grows with each builder task. */
export function useFlowEditor(flowId: string): FlowEditor {
  const { t } = useTranslation();
  // Read the latest `t` without making callbacks depend on it.
  const tRef = useRef(t);
  tRef.current = t;

  const [flow, setFlow] = useState<FlowDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatusState] = useState<FlowStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [graph, setGraph] = useState<Graph>({ nodes: [], edges: [] });
  const [variables, setVariables] = useState<Record<string, unknown>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    flowApi
      .get(flowId)
      .then((row) => {
        if (cancelled) return;
        setFlow(row);
        setName(row.name);
        setStatusState(row.status);
        setVariables(row.variables);
        setGraph({
          nodes: toCanvasNodes(normalizeFlowNodes(row.nodes)),
          edges: toCanvasEdges(normalizeFlowEdges(row.edges)),
        });
        setSelectedId(null);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [flowId]);

  // A removed node (Delete key, inspector button, undo) can no longer be selected.
  useEffect(() => {
    if (selectedId && !graph.nodes.some((n) => n.id === selectedId))
      setSelectedId(null);
  }, [graph.nodes, selectedId]);

  const canSave = flow !== null && name.trim() !== "" && !saving;

  const save = useCallback(async () => {
    if (!flow || name.trim() === "") return false;
    setSaving(true);
    try {
      const payload = buildFlowPayload(graph.nodes, graph.edges, variables);
      const saved = await flowApi.update(flow.id, {
        name: name.trim(),
        status,
        ...payload,
      });
      setFlow(saved);
      setName(saved.name);
      message.success(tRef.current("flows.builder.saved"));
      return true;
    } catch {
      message.error(tRef.current("flows.builder.saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [flow, name, status, graph, variables]);

  const setStatus = useCallback(
    (value: FlowStatus) => {
      if (!flow) return;
      const previous = status;
      setStatusState(value);
      flowApi
        .update(flow.id, { status: value })
        .then(setFlow)
        .catch(() => {
          setStatusState(previous);
          message.error(tRef.current("flows.builder.saveFailed"));
        });
    },
    [flow, status],
  );

  const addNode = useCallback(
    (nodeId: string, at?: { x: number; y: number }) => {
      const def = getNodeDef(nodeId);
      if (!def) return;
      const label = tRef.current(`flows.nodes.${def.id}.title`);
      const id = newId();
      setGraph(
        (g) => addNodeToGraph(g, def, { id, label, at, selectedId }).graph,
      );
      setSelectedId(id);
    },
    [selectedId],
  );

  const deleteNode = useCallback((id: string) => {
    setGraph((g) => removeNode(g, id));
  }, []);

  const updateNode = useCallback((updated: Node) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === updated.id ? updated : n)),
    }));
  }, []);

  const applyTemplate = useCallback((template: BuiltFlowTemplate) => {
    setGraph({
      nodes: toCanvasNodes(template.nodes),
      edges: toCanvasEdges(template.edges),
    });
    setSelectedId(null);
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setGraph((g) => ({ ...g, nodes: applyNodeChanges(changes, g.nodes) }));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setGraph((g) => ({ ...g, edges: applyEdgeChanges(changes, g.edges) }));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setGraph((g) => connect(g, connection, newId()));
  }, []);

  return {
    flow,
    loading,
    notFound,
    name,
    setName,
    status,
    setStatus,
    saving,
    canSave,
    save,
    nodes: graph.nodes,
    edges: graph.edges,
    selectedId,
    select: setSelectedId,
    addNode,
    deleteNode,
    updateNode,
    applyTemplate,
    onNodesChange,
    onEdgesChange,
    onConnect,
  };
}

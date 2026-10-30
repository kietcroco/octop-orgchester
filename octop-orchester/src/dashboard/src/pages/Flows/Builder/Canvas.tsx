import type { DragEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTheme } from "../../../context/ThemeContext";
import { FLOW_NODE_TYPES } from "../lib/node-types";
import type { BuiltFlowTemplate } from "../lib/templates";
import { EmptyCanvasGuide } from "./EmptyCanvasGuide";
import { NodeCard } from "./nodes/NodeCard";
import styles from "./index.module.less";

/** Every engine type draws with the same card until a node needs its own. */
const NODE_TYPES: NodeTypes = Object.fromEntries(
  FLOW_NODE_TYPES.map((type) => [type, NodeCard]),
);

export interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onSelect: (id: string | null) => void;
  onAddNode: (nodeId: string, at?: { x: number; y: number }) => void;
  onApplyTemplate: (template: BuiltFlowTemplate) => void;
}

/** The drawing area (needs a ReactFlowProvider above it). */
export function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelect,
  onAddNode,
  onApplyTemplate,
}: CanvasProps) {
  const { mode } = useTheme();
  const flow = useReactFlow();

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const nodeId = event.dataTransfer.getData("application/flow-node");
    if (!nodeId) return;
    onAddNode(
      nodeId,
      flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    );
  };

  const applyTemplate = (template: BuiltFlowTemplate) => {
    onApplyTemplate(template);
    // The new graph is not on screen yet: fit it once it has been laid out.
    setTimeout(() => void flow.fitView({ padding: 0.3 }), 50);
  };

  return (
    <div
      className={styles.canvasDrop}
      data-testid="builder-canvas-drop"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        colorMode={mode}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
      {nodes.length === 0 && (
        <EmptyCanvasGuide
          onAddNode={(id) => onAddNode(id)}
          onApplyTemplate={applyTemplate}
        />
      )}
    </div>
  );
}

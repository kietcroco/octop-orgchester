import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { Spin } from "antd";

import { EmptyState } from "../../../components/EmptyState";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { NodePalette } from "./NodePalette";
import { Toolbar } from "./Toolbar";
import { useFlowEditor } from "./useFlowEditor";
import styles from "./index.module.less";

/**
 * The flow builder: toolbar on top, node palette on the left, canvas in the
 * middle, inspector on the right (the layout of Orchester's FlowBuilder).
 * The catalog of nodes starts empty, so the palette fills up as nodes are added.
 */
export function FlowBuilder({ flowId }: { flowId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const editor = useFlowEditor(flowId);

  if (editor.loading) {
    return (
      <div className={styles.centered}>
        <Spin />
      </div>
    );
  }

  if (editor.notFound || !editor.flow) {
    return (
      <div className={styles.centered}>
        <EmptyState
          variant="mascot"
          title={t("flows.notFound")}
          description={t("flows.notFoundHint")}
          actionLabel={t("flows.back")}
          onAction={() => navigate("/flows")}
        />
      </div>
    );
  }

  const selectedNode =
    editor.nodes.find((node) => node.id === editor.selectedId) ?? null;

  return (
    <ReactFlowProvider>
      <div className={styles.builder}>
        <Toolbar
          name={editor.name}
          onNameChange={editor.setName}
          status={editor.status}
          onStatusChange={editor.setStatus}
          saving={editor.saving}
          canSave={editor.canSave}
          onSave={() => void editor.save()}
          onBack={() => navigate("/flows")}
        />
        <div className={styles.body}>
          <aside className={styles.palette} data-testid="builder-palette">
            <NodePalette onAdd={(nodeId) => editor.addNode(nodeId)} />
          </aside>
          <main className={styles.canvas} data-testid="builder-canvas">
            <Canvas
              nodes={editor.nodes}
              edges={editor.edges}
              onNodesChange={editor.onNodesChange}
              onEdgesChange={editor.onEdgesChange}
              onConnect={editor.onConnect}
              onSelect={editor.select}
              onAddNode={editor.addNode}
              onApplyTemplate={editor.applyTemplate}
            />
          </main>
          <aside className={styles.inspector} data-testid="builder-inspector">
            <Inspector
              node={selectedNode}
              onChange={editor.updateNode}
              onDelete={editor.deleteNode}
            />
          </aside>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default FlowBuilder;

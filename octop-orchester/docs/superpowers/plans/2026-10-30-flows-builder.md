# Flows — Builder UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Trang `/flows/:flowId` trở thành **khung builder**: toolbar, palette (lúc đầu **rỗng**), canvas kéo-thả, inspector khung, undo/redo, tidy, kiểm tra cơ bản, autosave — bám builder của Orchester, chạy trên `flowApi` giả. **Chưa có node nào trong catalog**: mỗi node được đưa lên UI **trọn gói, từng node một** (catalog + palette + thẻ trên canvas + field cấu hình + logic + test) ở các task node sau khung.

**Architecture:** Logic thuần (catalog node, mapping, payload, layout, graph ops, history, validate cơ bản) ở `pages/Flows/lib/`, có test riêng; UI antd + `@xyflow/react` (đã có nhờ patch org-chart) ở `pages/Flows/Builder/`. Hook `useFlowEditor` giữ state. Mọi chữ qua i18n key. Catalog node **bắt đầu rỗng**; mỗi task node thêm đúng một entry (metadata, `fields`, handle, quy tắc validate) và key i18n của nó — palette, canvas, inspector tự nhận mà **không sửa khung**. Node trong flow đã lưu mà catalog chưa có (ví dụ từ template) hiển thị bằng thẻ dự phòng, không lỗi.

**Tech Stack:** React 18, antd 5, less module, `@xyflow/react` ^12.12, react-i18next, lucide-react, vitest + Testing Library. Không thêm dependency, không patch package.json.

**Spec:** [`octop-orchester/docs/04-FLOWS-ARCHITECTURE.md`](../../04-FLOWS-ARCHITECTURE.md) (§3.2 B1–B15, §5.2, §6.2 danh mục 31 node, §7). Plan trước: [`2026-10-30-flows-list-and-create.md`](2026-10-30-flows-list-and-create.md) (đã xong).

> **Trạng thái (2026-10-30): Task 1–5 XONG, Task 6 CHƯA LÀM, chưa có node nào.** Hướng dẫn tiếp tục (thêm node, lệnh, bẫy đã gặp, nhật ký quyết định): [`../../05-FLOWS-NODE-GUIDE.md`](../../05-FLOWS-NODE-GUIDE.md). Các ô đã tick là việc đã làm; ô chưa tick (Task 6) là việc còn lại.
>
> **Khác plan khi triển khai** (kể cả những chỗ text bên dưới đã cũ):
> - Task 1: thêm `scripts/regen_flows_locale_patches.py` (sinh lại patch locale bằng một lệnh) và `lib/node-copy.test.ts` (mọi node trong catalog phải có copy ở 3 ngôn ngữ); test bất biến của catalog là **một test lặp**, không dùng `it.each` (vitest lỗi với mảng rỗng).
> - Task 3: `icon-map` bắt đầu **rỗng**; hàm `newId()` được export từ `api/modules/flows.ts`; vị trí mặc định của node mới là cascade xác định.
> - Task 4: palette **luôn hiện đủ 6 nhóm** (mỗi nhóm có số đếm và dòng "Chưa có bước nào" — key `flows.builder.groupEmpty`); khi tìm kiếm chỉ giữ nhóm có kết quả; key `paletteEmpty` đã bỏ.
> - Task 5: node ngoài catalog hiện **loại engine** làm tiêu đề inspector; `renderFields` chưa được nối trong `Builder/index.tsx` (node đầu tiên có field sẽ nối).
> - Thêm công cụ: `scripts/dashboard_format.sh` (Prettier), cờ `--lint` của `dashboard_test.sh`. Code Flows đạt ESLint + Prettier; `tsc -b` sạch (đã sửa 4 lỗi của `Settings/Webhooks`).

## Phạm vi và quyết định

**Trong plan này (khung builder, không có node):** B1–B7 (khung, toolbar, canvas, thẻ node dự phòng, palette, inspector khung), B9–B15 (undo/redo, copy/paste, tidy, validate cơ bản, normalize, autosave, canvas trống).

**Không trong plan này (làm theo từng node):** mọi thứ gắn với một node cụ thể — mục trong palette, `fields` và field renderer/picker, giá trị mặc định, handle rẽ nhánh, quy tắc validate riêng, thẻ node riêng, executor. Plan này chỉ chừa chỗ cắm (§ "Mỗi task node").

Quyết định đã chốt:
- **Node lên UI từng cái một.** Catalog rỗng lúc đầu nên palette hiện trạng thái trống ("chưa có node"); mỗi node làm xong là tự xuất hiện ở palette. Để vẫn xem được canvas/inspector/undo/tidy trước khi có node, mở flow tạo từ template (FAQ, Báo khi có tin nhắn): các node `trigger`/`agent`/`notify` của template hiện bằng **thẻ dự phòng** (icon chung, tên lưu trong flow).
- **Catalog chỉ giữ i18n key**, không giữ chuỗi: `flows.nodes.<id>.{title,summary}` (thêm theo từng node), `flows.categories.<nhóm>` (thêm sẵn 6 nhóm ở Task 1).
- **Tidy layout không dùng dagre** (không có trong lockfile; patch lock giòn). Layout phân tầng thuần, cùng chữ ký `autoLayout` của Orchester.
- **Nút Run hiện nhưng tắt**, tooltip "cần engine".
- **Validate vòng này có 3 quy tắc** (thiếu trigger, cạnh gãy, node rời). Quy tắc "thiếu field bắt buộc" đi kèm node khi node có field.
- Trang chi tiết `/flows/:flowId` bỏ `PageShell` và placeholder `builderSoon`.

## Global Constraints

- UI chỉ dùng antd + less module + lucide-react + `@xyflow/react`; không Tailwind/HeroUI/framer-motion/sonner. Toast qua `@/utils/antdMessage`, xác nhận qua `@/utils/antdModal`.
- Không thêm dependency; không thêm patch upstream mới (chỉ file overlay + sinh lại patch locale `workflow-ui` đã có).
- Shape lưu giữ nguyên `StoredFlowNode`/`StoredFlowEdge` của `api/modules/flows.ts`. Node canvas: `{ id, type: engine, position, data: { nodeId, label, config } }`.
- Trigger dùng chung engine `trigger`, phân biệt bằng `config.triggerKind` (`manual|message|schedule|webhook`); id catalog là `trigger_<kind>` (`registryIdOf`).
- Hàm thuần nhận `NodeDef`/registry làm tham số (mặc định là catalog thật) để test được khi catalog còn rỗng; test của khung dùng registry giả, không đợi node thật.
- Mọi chuỗi hiển thị qua `t()` với key `flows.*`; en/zh/vi đủ key trước khi code dùng; test i18n mock trả về chính key.
- Dữ liệu lưu hỏng hoặc node có `type` lạ không được làm sập builder.
- Bố cục 3 cột như Orchester: palette 224px trái, inspector 288px phải, panel kiểm tra nổi.
- Không commit nếu người dùng chưa yêu cầu; cuối mỗi task dừng chờ duyệt.

## Review Focus

1. Flow đã lưu có node mà catalog chưa có, `type` lạ hoặc `config` thiếu → builder vẫn mở: node chưa có trong catalog hiện thẻ dự phòng, `type` lạ hiện thành ghi chú, không crash (Task 1, 3).
2. Đồ thị có vòng (A→B→A) → tidy không treo, không chồng node (Task 1).
3. Xoá node đang chọn → các cạnh liên quan cũng bị xoá, inspector về trạng thái trống (Task 3).
4. Autosave: chỉ chọn/đo node (xyflow tự bắn thay đổi) → không ghi lại flow (Task 6).
5. Round-trip stored → canvas → stored không đổi (Task 1).

---

## File Structure

```
octop-orchester/src/dashboard/src/pages/Flows/
├── index.tsx                      (sửa) /flows/:flowId → <FlowBuilder>, bỏ detail placeholder             [T2]
├── lib/
│   ├── node-types.ts              FLOW_NODE_TYPES (29), FlowNodeType                                      [T1]
│   ├── field-types.ts, node-catalog.ts   kiểu field + catalog node (RỖNG lúc đầu) + getNodeDef/list…      [T1]
│   ├── normalize.ts, node-mapping.ts, payload.ts, layout.ts, validate.ts                                  [T1]
│   ├── graph.ts                   addNodeToGraph, removeNode, duplicateNode, connect                      [T3]
│   └── history.ts                 createHistory / push / undo / redo                                      [T6]
└── Builder/
    ├── index.tsx, index.module.less   FlowBuilder: toolbar + 3 cột                                        [T2]
    ├── useFlowEditor.ts           state + hành động                                                       [T2→T6]
    ├── Toolbar.tsx                                                                                        [T2, T6]
    ├── Canvas.tsx, nodes/{NodeCard,icon-map}.tsx, EmptyCanvasGuide.tsx                                    [T3]
    ├── NodePalette.tsx                                                                                    [T4]
    ├── Inspector.tsx                                                                                      [T5]
    └── ValidationPanel.tsx                                                                                [T6]
(+ *.test.ts(x) cạnh từng file) · scripts/add_flows_i18n.py (mở rộng) · patches/dashboard/src/locales/{en,zh}.json.workflow-ui.patch (sinh lại)
```

Lệnh chạy từ **gốc repo** trong Git Bash. Test: `bash octop-orchester/scripts/dashboard_test.sh <đường dẫn vitest>`; type-check: `… dashboard_test.sh --tsc` (nền có 4 lỗi ở `Settings/Webhooks`, không tính). Một test nền đỏ sẵn: `sidebarNavLayout … omits nav items and built-in groups the user cannot access`.

---

### Task 1: Nền tảng logic thuần + catalog rỗng + copy nhóm (không có UI)

**Files:** tạo các file `lib/` có `[T1]` cùng test cạnh chúng; sửa `scripts/add_flows_i18n.py`, `src/dashboard/src/locales/vi.json`, `patches/dashboard/src/locales/{en,zh}.json.workflow-ui.patch`, `scripts/vi-i18n/check_parity.py` (nếu thêm tiền tố), `patches/lock.json`.

**Interfaces:**
- Consumes: `StoredFlowNode`, `StoredFlowEdge` từ `api/modules/flows.ts`.
- Produces:
  ```ts
  // node-types.ts — port nguyên từ orchester lib/flows/node-types.ts
  export const FLOW_NODE_TYPES: readonly [...29 loại...]; export type FlowNodeType;
  // field-types.ts — port kiểu từ orchester lib/flows/field-types.ts (chỉ kiểu, chưa có renderer)
  export type FieldType; export interface FieldDef { key: string; type: FieldType; required?: boolean;
    advanced?: boolean; options?: string[]; dependsOn?: { key: string; value: string } }
  // node-catalog.ts
  export type NodeCategory = "trigger"|"ai"|"logic"|"apps"|"data"|"actions";
  export interface NodeDef { id: string; engine: FlowNodeType; category: NodeCategory; icon: string;
    accent: string; fields: FieldDef[]; defaults?: Record<string, unknown>;
    fixedConfig?: Record<string, unknown>; outputs?: string[] }
  export const NODE_REGISTRY: Record<string, NodeDef>;       // = {} ; mỗi task node thêm đúng một entry
  export const CATEGORY_ORDER: readonly NodeCategory[];
  export function getNodeDef(id: string, registry?: Record<string, NodeDef>): NodeDef | undefined;
  export function listNodesByCategory(registry?: Record<string, NodeDef>): { category: NodeCategory; nodes: NodeDef[] }[];
  export function registryIdOf(type: string, config: Record<string, unknown>): string;
  // normalize.ts
  export function normalizeFlowNodes(raw: unknown): StoredFlowNode[];
  export function normalizeFlowEdges(raw: unknown): StoredFlowEdge[];
  // node-mapping.ts   (canvas node = {id,type,position,data:{nodeId,label,config}})
  export function toCanvasNodes(nodes: StoredFlowNode[]): Node[];
  export function toCanvasEdges(edges: StoredFlowEdge[]): Edge[];
  // payload.ts
  export interface FlowGraphPayload { nodes: StoredFlowNode[]; edges: StoredFlowEdge[]; variables: Record<string, unknown> }
  export function buildFlowPayload(nodes: Node[], edges: Edge[], variables: Record<string, unknown>): FlowGraphPayload;
  export function flowSignature(payload: FlowGraphPayload): string;
  // validate.ts
  export type ValidationCode = "no_trigger" | "broken_edge" | "disconnected";
  export interface ValidationIssue { level: "error"|"warning"; code: ValidationCode; nodeId?: string }
  export function validateFlow(nodes: Node[], edges: Edge[]): ValidationIssue[];
  // layout.ts
  export function autoLayout<T extends { id: string; position: {x:number;y:number} }>(
    nodes: T[], edges: { source: string; target: string }[],
    sizeOf?: (n: T) => { width: number; height: number }): T[];
  ```
  `validateFlow` nhận biết trigger bằng `node.type === "trigger"` (engine), không cần catalog.

- [x] **Step 1: Test catalog (đỏ).** `node-catalog.test.ts`: (a) `registryIdOf("trigger",{triggerKind:"message"})="trigger_message"`, `("agent",{})="agent"`, `("trigger",{})="trigger_manual"`; (b) `listNodesByCategory(registryGiả)` trả nhóm theo `CATEGORY_ORDER`, bỏ nhóm rỗng, mỗi node đúng một lần; `listNodesByCategory({})` → `[]`; (c) `getNodeDef("x", registryGiả)` trả đúng/`undefined`; (d) **bất biến cho mọi registry thật hiện tại và sau này** (`NODE_REGISTRY`): khoá bằng `def.id`, `def.engine ∈ FLOW_NODE_TYPES`, trigger có `fixedConfig.triggerKind` khớp hậu tố id, `fields` không trùng `key` — đúng với `{}` hôm nay và trở thành rào chắn thật khi node được thêm.
- [x] **Step 2: Chạy, xác nhận đỏ** (`…dashboard_test.sh src/pages/Flows/lib/node-catalog.test.ts`) → thiếu module.
- [x] **Step 3: Cài `node-types.ts`, `field-types.ts`, `node-catalog.ts`** (`NODE_REGISTRY = {}`). Chạy lại → PASS.
- [x] **Step 4: Test + cài `normalize.ts`, `node-mapping.ts`, `payload.ts`** (đỏ → xanh từng file). Test chính: normalize bỏ item không phải object, sinh id/position mặc định; **node có `type` ngoài `FLOW_NODE_TYPES` ∪ `"end"` thành node `note` giữ nguyên `label`**, còn node có `type` hợp lệ nhưng chưa có trong catalog được **giữ nguyên** (Review Focus 1); cạnh thiếu source/target bị bỏ; `toCanvasNodes` đặt `data.nodeId = registryIdOf(type, config)` bất kể catalog; **round-trip** `buildFlowPayload(toCanvasNodes(n), toCanvasEdges(e), v)` bằng `{nodes:n, edges:e, variables:v}` cho cả 3 template (Review Focus 5); `flowSignature` bằng nhau với hai payload cùng nội dung khác tham chiếu, khác khi đổi `position`.
- [x] **Step 5: Test + cài `validate.ts`** (đỏ → xanh): flow rỗng → `[]`; có node nhưng không có node `type:"trigger"` → `no_trigger` (error); cạnh trỏ tới node không tồn tại → `broken_edge` (error); node không nối với gì (trừ `type:"trigger"`, `type:"note"`, và khi flow chỉ có 1 node) → `disconnected` (warning, kèm `nodeId`).
- [x] **Step 6: Test + cài `layout.ts`** (đỏ → xanh): chuỗi a→b→c tăng `x`, cùng `y`; hình thoi a→(b,c)→d: b,c cùng `x` khác `y`, d xa nhất; **đồ thị có vòng a→b→a không treo, toạ độ hữu hạn, không hai node chồng nhau** (Review Focus 2); node rời vào tầng 0; `[]` → `[]`; giữ nguyên các thuộc tính khác của node. Cách làm: phân tầng theo đường dài nhất sau khi bỏ cạnh ngược (DFS); cột `x = tầng*(W+96)`; trong tầng xếp theo trung bình `y` của tiền nhiệm; mặc định `W=210, H=64`, khoảng cách dọc 56.
- [x] **Step 7: Copy i18n.** Mở rộng `COPY` trong `scripts/add_flows_i18n.py` (en/zh/vi): `flows.categories.<6 nhóm>` và `flows.builder.*` cho mọi chuỗi UI của Task 2–6 (mỗi task liệt kê key của nó; thêm vào đây khi viết task). **Không** thêm copy của node — mỗi task node tự thêm `flows.nodes.<id>.*`. Script đổi hành vi: en/zh **luôn sinh nhóm `flows` đầy đủ** trên worktree *không áp patch locale `workflow-ui`*; `vi.json` (JSON round-trip đã kiểm là không mất byte) **thay nguyên nhóm `flows`**. Kiểm bằng script: mọi key `flows.*` mà code `Flows/` gọi `t("…")` đều có ở cả 3 ngôn ngữ.
- [x] **Step 8: Sinh lại patch locale.** Dựng worktree upstream (`git -c core.autocrlf=false -C octop worktree add --detach /tmp/octo-flows-wt HEAD`), áp mọi patch `dashboard/` và `src/` **trừ** `en.json.workflow-ui.patch`/`zh.json.workflow-ui.patch`, `git add -A`, chạy script với `--octop-dir`, `git diff` từng file ra patch mới, gỡ worktree. Kiểm: `python octop-orchester/scripts/patch_status.py --apply-check` sạch, `check_parity.py` OK, `--record`.
- [x] **Step 9: Chạy** `…dashboard_test.sh src/pages/Flows src/api/modules/flows.test.ts` và `--tsc` → xanh (chỉ 4 lỗi nền). Dừng duyệt Task 1.

---

### Task 2: Khung builder + toolbar + tải/lưu

**Files:** tạo `Builder/index.tsx`, `Builder/index.module.less`, `Builder/Toolbar.tsx`, `Builder/useFlowEditor.ts`, `Builder/index.test.tsx`; sửa `pages/Flows/index.tsx`, `pages/Flows/index.test.tsx`.

**Interfaces:**
- Consumes: `flowApi.get/update`, `FlowDTO`, `FlowStatus`, `STATUS_TAG_COLOR` (từ `components/FlowCard`).
- Produces:
  ```ts
  export interface FlowEditor { flow: FlowDTO | null; loading: boolean; notFound: boolean;
    name: string; setName(v: string): void; status: FlowStatus; setStatus(v: FlowStatus): void;
    saving: boolean; save(): Promise<boolean> }
  export function useFlowEditor(flowId: string): FlowEditor;
  export function FlowBuilder(props: { flowId: string }): JSX.Element;
  ```
  `FlowsPage` với `flowId` render `<FlowBuilder flowId>`; `FlowDetailView` và key `builderSoon` bỏ.
- i18n keys: `flows.builder.{back,nameLabel,statusLabel,save,saved,saveFailed,run,runDisabled}`.

- [x] **Step 1: Test (đỏ).** `Builder/index.test.tsx` (mock `flowApi`, `useNavigate`): (a) tải xong thấy tên flow trong ô tên; nút `flows.builder.run` bị `disabled`, tooltip `flows.builder.runDisabled`; (b) sửa tên rồi bấm `flows.builder.save` → `flowApi.update(id, expect.objectContaining({ name: "Mới" }))` và toast `flows.builder.saved`; update reject → toast `flows.builder.saveFailed`; (c) đổi trạng thái ở `Select` → `update(id, {status})`; (d) nút quay lại → `navigate("/flows")`; (e) `get` reject → `EmptyState` `flows.notFound` + nút quay lại, không crash; (f) tên rỗng/toàn khoảng trắng → bấm lưu không gọi `update`; (g) thân có ba vùng `data-testid` `builder-palette`, `builder-canvas`, `builder-inspector`. Cập nhật `pages/Flows/index.test.tsx`: nhóm "detail placeholder" đổi thành "route `/flows/:id` render FlowBuilder" (mock `./Builder` thành stub).
- [x] **Step 2: Chạy, xác nhận đỏ.**
- [x] **Step 3: Cài `useFlowEditor`, `Toolbar`, `FlowBuilder`, less.** Hàng toolbar: quay lại · ô tên sửa tại chỗ (`maxLength 64`) · `Select` trạng thái · (chỗ cho cụm hành động Task 6) · nút Lưu · nút Run tắt; thân ba cột (palette 224px · canvas `flex:1` · inspector 288px — Task 2 chỉ là khung rỗng). `height:100%`, không `PageShell`.
- [x] **Step 4: Chạy test → xanh; `--tsc`.** Dừng duyệt Task 2 (xem được: bấm flow ở danh sách → khung builder 3 cột; sửa tên/trạng thái/lưu).

---

### Task 3: Canvas + thẻ node + kết nối

**Files:** tạo `lib/graph.ts` (+test), `Builder/Canvas.tsx`, `Builder/nodes/{NodeCard,icon-map}.tsx`, `Builder/EmptyCanvasGuide.tsx` và test cạnh chúng; sửa `Builder/index.tsx`, `Builder/useFlowEditor.ts`, `Builder/index.module.less`.

**Interfaces:**
- Consumes: Task 1 (`toCanvasNodes/Edges`, `normalizeFlowNodes/Edges`, `getNodeDef`, `listNodesByCategory`, `NodeDef`), Task 2 (`useFlowEditor`).
- Produces:
  ```ts
  // lib/graph.ts — thuần; nhận NodeDef trực tiếp nên test được khi catalog rỗng
  export interface Graph { nodes: Node[]; edges: Edge[] }
  export function addNodeToGraph(g: Graph, def: NodeDef, opts: { id: string; label: string;
    at?: { x: number; y: number }; selectedId?: string | null }): { graph: Graph; added: Node };
  export function removeNode(g: Graph, id: string): Graph;                 // xoá cả cạnh liên quan
  export function duplicateNode(g: Graph, id: string, newId: string): { graph: Graph; added: Node } | null;
  export function connect(g: Graph, c: { source: string; target: string; sourceHandle?: string | null }, edgeId: string): Graph;
  // useFlowEditor thêm
  nodes: Node[]; edges: Edge[]; selectedId: string | null; select(id: string | null): void;
  addNode(nodeId: string, at?: {x:number;y:number}): void;   // tra getNodeDef(nodeId); không có trong catalog → bỏ qua
  deleteNode(id: string): void; applyTemplate(template: BuiltFlowTemplate): void;
  onNodesChange(c: NodeChange[]): void; onEdgesChange(c: EdgeChange[]): void; onConnect(c: Connection): void;
  ```
- i18n keys: `flows.builder.{emptyTitle,emptyHint,templatesTitle,startersTitle,unknownNode}`.

- [x] **Step 1: Test `graph.ts` (đỏ).** Dùng `NodeDef` giả (một trigger, một node thường). `addNodeToGraph`: không có `at` và có `selectedId` → node mới ở `selected.x + 260`, cùng `y`, **tự nối cạnh** từ node đang chọn; def là trigger (`engine:"trigger"`) → **không** tự nối; có `at` thì đặt đúng `at`, không nối; node mới có `type = def.engine`, `data = { nodeId: def.id, label, config: {...defaults, ...fixedConfig} }`. `removeNode` xoá node và mọi cạnh có `source`/`target` là nó, node khác giữ nguyên (Review Focus 3). `duplicateNode`: lệch `(+40,+40)`, deep-clone `data`, không sao chép cạnh, id không tồn tại → `null`. `connect`: thêm cạnh; bỏ qua tự nối và cạnh trùng.
- [x] **Step 2: Chạy → đỏ → cài `graph.ts` → xanh.**
- [x] **Step 3: Test thẻ node (đỏ).** `nodes/NodeCard.test.tsx` (bọc `ReactFlowProvider`; mock `getNodeDef`): (a) **node có trong catalog:** hiện `label`, icon và viền màu `accent` của def; trigger **không** có handle đích, node khác có cả đích và nguồn; (b) **node chưa có trong catalog** (`nodeId` lạ hoặc catalog rỗng, vd node `agent` của template): hiện thẻ dự phòng — icon `Box`, màu trung tính, tên là `label` đã lưu (rỗng thì `flows.builder.unknownNode`) — vẫn có handle đích/nguồn để nối dây được, **không ném lỗi** (Review Focus 1); (c) node `type:"note"` hiện `config.text` nếu có. `icon-map.test.ts`: mọi `icon` của `NODE_REGISTRY` có trong `NODE_ICONS`, và mọi tên trong `NODE_ICONS` tồn tại trong `lucide-react` 0.562 (thiếu thì test đỏ).
- [x] **Step 4: Cài `icon-map`, `NodeCard`** (port tinh thần `SimpleNode` + `RegistryNode` của Orchester; Tailwind → less module + token `--fn-*`; mọi engine type dùng chung một `nodeTypes` map trỏ về `NodeCard`).
- [x] **Step 5: Test canvas (đỏ).** `Canvas.test.tsx` (mock `listNodesByCategory`): render 2 node → thấy 2 nhãn; canvas trống → `EmptyCanvasGuide` hiện **template** từ `FLOW_TEMPLATES` và, nếu catalog có node nhóm `trigger`, thêm các nút trigger gợi ý (không có trigger nào trong catalog → ẩn mục này); bấm một trigger → `addNode(<id>)`; bấm template → `applyTemplate(<built>)`; có node thì ẩn guide; `colorMode` lấy từ `useTheme().mode` (mock); có `Background`, `Controls`, `MiniMap`; nhận `drop` dữ liệu `application/flow-node` → `addNode(nodeId, screenToFlowPosition(...))`.
- [x] **Step 6: Cài `Canvas`, `EmptyCanvasGuide`; mở rộng `useFlowEditor`** (state khởi tạo từ `toCanvasNodes(normalizeFlowNodes(flow.nodes))`; `save()` dùng `buildFlowPayload`; `onNodesChange/onEdgesChange` dùng `applyNodeChanges/applyEdgeChanges`; chọn node cập nhật `selectedId`; bấm nền bỏ chọn). Nối vào `FlowBuilder`.
- [x] **Step 7: Chạy** `src/pages/Flows` + `--tsc` → xanh. Dừng duyệt Task 3 (xem được: mở flow tạo từ template FAQ/Báo tin → thấy 2 thẻ nối nhau; kéo vị trí, nối dây, xoá node; canvas trống có hướng dẫn với template).

---

### Task 4: Palette (rỗng lúc đầu, tự lớn theo node)

**Files:** tạo `Builder/NodePalette.tsx` (+test); sửa `Builder/index.tsx`.

**Interfaces:**
- Consumes: Task 1 (`listNodesByCategory`, `NodeDef`), Task 3 (`NODE_ICONS`, `addNode`).
- Produces: `export function NodePalette(props: { onAdd(nodeId: string): void; registry?: Record<string, NodeDef> }): JSX.Element` — ô tìm kiếm, nhóm theo `CATEGORY_ORDER`, mỗi mục kéo thả (`dataTransfer 'application/flow-node'`) hoặc bấm để thêm. `registry` mặc định `NODE_REGISTRY`.
- i18n keys: `flows.builder.{paletteSearch,paletteNoMatch,paletteEmpty}`.

- [x] **Step 1: Test (đỏ).** Truyền `registry` giả có 3 node thuộc 2 nhóm: (a) hiện đúng các nhóm có node, tiêu đề `flows.categories.*`, theo `CATEGORY_ORDER`, nhóm rỗng không hiện; (b) gõ tìm kiếm lọc theo `flows.nodes.<id>.title` và `.summary` (không phân biệt hoa thường), không khớp → `flows.builder.paletteNoMatch`; (c) bấm mục gọi `onAdd(<id>)`; (d) `dragStart` đặt `application/flow-node` = id node; (e) mỗi mục có `title` (tooltip) là summary; (f) **`registry={}` → hiện `flows.builder.paletteEmpty`** (trạng thái thật của palette trước khi có node) và không có ô lỗi.
- [x] **Step 2: Chạy → đỏ → cài `NodePalette` → xanh** (port từ Orchester `NodePalette.tsx`; antd `Input` + less, cuộn dọc, mục gồm icon màu + tên + mô tả một dòng). Nối vào cột trái của `FlowBuilder`.
- [x] **Step 3: Test tích hợp:** trong `Builder/index.test.tsx` (mock `NODE_REGISTRY` có một node), bấm một mục palette → canvas có thêm node; khi đang chọn một node thì có thêm cạnh mới. `src/pages/Flows` + `--tsc`. Dừng duyệt Task 4 (xem được: cột trái có ô tìm kiếm và dòng "chưa có node"; palette sẽ đầy dần ở các task node).

---

### Task 5: Inspector khung

**Files:** tạo `Builder/Inspector.tsx` (+test); sửa `Builder/index.tsx`, `Builder/useFlowEditor.ts`.

**Interfaces:**
- Consumes: Task 1 (`getNodeDef`), Task 3 (`selectedId`, `deleteNode`).
- Produces:
  ```ts
  export function Inspector(props: { node: Node | null; onChange(n: Node): void; onDelete(id: string): void;
    /** Chỗ cắm cho task node: nhận node và trả form field của node đó. Hôm nay luôn undefined. */
    renderFields?: (node: Node, onChange: (n: Node) => void) => React.ReactNode }): JSX.Element;
  // useFlowEditor: updateNode(n: Node): void   (thay node cùng id)
  ```
- i18n keys: `flows.builder.{inspectorEmpty,nodeName,nodeType,deleteNode,noSettingsYet}`.

- [x] **Step 1: Test (đỏ).** (a) `node=null` → `flows.builder.inspectorEmpty`; (b) chọn một node **có trong catalog** (mock) → thấy tiêu đề và mô tả từ `flows.nodes.<id>.*`, ô tên với giá trị `data.label`; node chưa có trong catalog → hiện `data.label` và `flows.builder.unknownNode`, vẫn sửa tên/xoá được; (c) sửa tên → `onChange` nhận node mới có `data.label` mới và giữ nguyên `data.config`; (d) bấm xoá → `onDelete(id)`; (e) node chưa có field (`fields` rỗng, không có `renderFields`) hiển thị `flows.builder.noSettingsYet`; (f) có `renderFields` thì render đúng nội dung đó thay cho dòng trên; (g) `renderFields` không được gọi cho node chưa có trong catalog.
- [x] **Step 2: Chạy → đỏ → cài `Inspector`** (cuộn dọc; tiêu đề, mô tả, ô tên, vùng cấu hình, nút xoá có `aria-label`) **+ `useFlowEditor.updateNode`**, nối vào cột phải. Chạy `src/pages/Flows` + `--tsc`. Dừng duyệt Task 5.

---

### Task 6: Hành động toolbar — undo/redo, copy/paste, tidy, kiểm tra, autosave

**Files:** tạo `lib/history.ts` (+test), `Builder/ValidationPanel.tsx` (+test); sửa `Builder/Toolbar.tsx`, `Builder/useFlowEditor.ts`, `Builder/index.tsx` và test của chúng.

**Interfaces:**
- Consumes: Task 1 (`autoLayout`, `validateFlow`, `buildFlowPayload`, `flowSignature`), Task 3 (`duplicateNode`, `removeNode`, `applyTemplate`).
- Produces:
  ```ts
  // lib/history.ts
  export interface History<T> { past: T[]; future: T[] }
  export const HISTORY_LIMIT = 50;
  export function createHistory<T>(): History<T>;
  export function pushHistory<T>(h: History<T>, snapshot: T): History<T>;      // xoá future, cắt còn 50
  export function undoHistory<T>(h: History<T>, current: T): { history: History<T>; snapshot: T } | null;
  export function redoHistory<T>(h: History<T>, current: T): { history: History<T>; snapshot: T } | null;
  // useFlowEditor thêm
  undo(): void; redo(): void; canUndo: boolean; canRedo: boolean; tidy(): void; copy(): void; paste(): void;
  duplicate(): void; issues: ValidationIssue[]; autoSaveStatus: "idle"|"saving"|"saved"|"error";
  ```
- i18n keys: `flows.builder.{undo,redo,tidy,review,saving,autoSaved,autoSaveError,issuesNone,issueNoTrigger,issueBrokenEdge,issueDisconnected,errors,warnings}`; thông điệp issue có tham số `{{step}}`.

- [ ] **Step 1: Test `history.ts` (đỏ→xanh):** push thêm vào `past` và xoá `future`; quá 50 thì bỏ phần tử cũ nhất; undo trả snapshot gần nhất và đẩy `current` vào `future`; redo ngược lại; undo/redo khi rỗng → `null`; không đột biến input.
- [ ] **Step 2: Test hook/UI (đỏ).** Trong `Builder/index.test.tsx`: (a) thêm node → `undo` đưa đồ thị về trước đó, `redo` làm lại, nút `disabled` đúng lúc; (b) Ctrl+Z, Ctrl+Shift+Z, Ctrl+C/V, Ctrl+D hoạt động khi không gõ trong ô nhập; (c) `tidy` đổi vị trí node nhưng giữ nguyên id/cạnh và undo được; (d) nút kiểm tra mở `ValidationPanel` liệt kê issue bằng ngôn ngữ thường với tên bước (key `flows.builder.issue*`); bấm một issue → chọn node đó và Inspector hiện node đó; không có issue → `flows.builder.issuesNone`; (e) **autosave:** sửa nội dung → sau 1s (fake timers) gọi `flowApi.update` đúng một lần với payload mới, trạng thái `saving → saved`; lỗi → `autoSaveError`; **chỉ chọn/đo node (không đổi `flowSignature`) → không gọi `update`** (Review Focus 4); lưu thủ công cập nhật chữ ký đã lưu nên không autosave lặp.
- [ ] **Step 3: Cài** `history.ts`; mở rộng `useFlowEditor` (mọi thao tác đồ thị gọi `pushHistory` trước khi đổi; autosave debounce 1000ms so `flowSignature`); `Toolbar` (undo, redo, tidy, review, chỉ báo autosave); `ValidationPanel` (panel nổi, đóng được, tách lỗi/cảnh báo); phím tắt (listener `keydown` bỏ qua khi focus ở `input/textarea/select/contenteditable`).
- [ ] **Step 4: Kiểm tra toàn bộ.**
  - `bash octop-orchester/scripts/dashboard_test.sh` (cả bộ vitest) → chỉ còn 9 test đỏ nền đã ghi.
  - `--tsc` → chỉ 4 lỗi nền ở Webhooks.
  - `python octop-orchester/scripts/patch_status.py --apply-check` sạch, `check_parity.py` OK, `--record`, `--report`.
  - Build thật: `cd octop-orchester && docker compose --progress=plain up -d --build`; container `healthy`; `GET /flows` 200.
- [ ] **Step 5: Dừng duyệt Task 6** (xem được: builder hoàn chỉnh về khung — mở flow tạo từ template, thêm node từ palette, nối, undo/redo, tidy, kiểm tra, tải lại trang vẫn còn).

---

## Mỗi task node (plan riêng cho từng node, làm sau khung)

Mỗi node lên UI **trọn gói trong một lần**, không sửa khung. Khuôn mẫu của một task node:

1. **Catalog + copy:** thêm một entry vào `NODE_REGISTRY` (id, engine, nhóm, icon, màu, `fixedConfig`/`defaults`, `fields`, `outputs` nếu rẽ nhánh) và key `flows.nodes.<id>.*` (tên, mô tả, nhãn/gợi ý/ví dụ từng field, nhãn option) ở en/zh/vi; sinh lại patch locale như Task 1 Step 8.
2. **Field renderer:** thêm các `FieldType` mà node cần và chưa có (ví dụ `cron`, `agent-picker`, `channel-picker`, `key-value`, `json`, `select`…) vào bộ render truyền qua `renderFields` của Inspector; picker lấy dữ liệu thật của octop (agent: `useAgent().agents`; kênh: `channelApi`).
3. **Thẻ node riêng khi cần:** node rẽ nhánh (`outputs`) hiển thị nhiều handle có nhãn.
4. **Validate:** thêm mã `missing_field` (và quy tắc riêng nếu có) vào `validateFlow`, tôn trọng `dependsOn`.
5. **Test:** entry catalog (id/engine/nhóm/`fixedConfig` — các bất biến ở Task 1 tự bắt lỗi), palette hiện node mới đúng nhóm, thêm node cho ra `config` mặc định đúng, mỗi field render và ghi đúng vào `config`, field bắt buộc trống bị báo, round-trip lưu/tải; nếu node đang được template dùng thì thêm test "node của template nay có trong catalog" cho node đó.
6. **Xem được:** build lại, node xuất hiện ở palette, kéo vào canvas, cấu hình ở inspector.

Thứ tự gợi ý theo spec §6.2: đợt 1 (`trigger_manual`, `trigger_message`, `trigger_schedule`, `agent`, `condition`, `http`, `notify`, `note`) → đợt 2 → đợt 3. **Bạn chọn node nào làm trước.**

## Self-Review (đã chạy)

- **Spec coverage:** B1–B7, B9–B15 phân vào Task 1–6 (khung, chưa có node); node và logic từng node theo khuôn "Mỗi task node"; B8 (spreadsheet), B16–B24 theo spec nằm ở giai đoạn sau. B17 (badge "AI steps") **chưa** có; thêm vào Task 6 nếu bạn muốn (hàm thuần ~150 dòng, cần phân loại node theo bản chất AI nên hợp làm cùng node `agent`).
- **Placeholder scan:** không "TBD"; copy i18n do người cài viết theo giọng nhóm `flows` hiện có, danh sách key liệt kê theo task.
- **Type consistency:** `Graph/Node/Edge` của xyflow dùng xuyên suốt; `useFlowEditor` mở rộng cộng dồn ở Task 2→3→5→6 với tên không đổi (`updateNode`, `addNode`, `deleteNode`, `applyTemplate`, `undo/redo`).
- **Proportion:** chữ ký, tên test + assertion, lệnh; không có thân hàm.

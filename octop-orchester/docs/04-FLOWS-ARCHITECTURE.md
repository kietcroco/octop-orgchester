# Kiến trúc — Flows (đưa Orchester Flows sang Octop)

| Dự án | Octop-Orchester |
|---|---|
| Phiên bản | 0.3 (list + thêm flow + khung builder đã triển khai; còn node, Task 6, backend) |
| Ngày | 2026-10-30 |
| Base | `octop/` @ `890111b7` (v0.9.16-824-g890111b7, tag v1.0.3b1) |
| Nguồn tham chiếu | `orchester/apps/web/components/flows/`, `orchester/apps/web/lib/flows/` |
| Tham chiếu | [05-FLOWS-NODE-GUIDE](05-FLOWS-NODE-GUIDE.md) (**trạng thái hiện tại + cách thêm node**), [00-PATCH-REGISTRY](00-PATCH-REGISTRY.md), [01-AGENCY](01-AGENCY-ARCHITECTURE.md), [02-ORGCHART](02-ORGCHART-ARCHITECTURE.md) |

## 1. Mục đích và phạm vi

Octop chưa có flow engine; chỉ có cron theo từng agent. Orchester có Flow Builder hoàn chỉnh (canvas kéo thả, 31 node trong registry — 29 loại engine, engine, lịch sử chạy). Mục tiêu: đưa chức năng tương tự sang Octop, **từng component một, mỗi component một lần duyệt**.

**Vòng 1 — "lên màn hình" (tài liệu này):** trang danh sách flow, thêm flow, trang builder. Chạy trên dữ liệu giả sau một interface `flowApi`. Chưa có backend, chưa có engine, chưa có lịch sử chạy.

**Thứ tự đã chốt (2026-10-30):** làm trước **C0 (khung) + C1 (danh sách) + C2 (thêm flow)**. Tiếp theo là **khung builder** (C3–C7: toolbar, palette, canvas, inspector khung, undo/redo, tidy, kiểm tra cơ bản, autosave) với **catalog node rỗng**. Sau đó **mỗi node lên UI trọn gói, từng node một** — xuất hiện ở palette, vẽ được trên canvas, cấu hình ở inspector cùng logic của nó (đợt 1 → 2 → 3, §6.2). Hai câu hỏi mở ở §9 chỉ ảnh hưởng builder nên chưa cần chốt lúc này.

**Không thuộc vòng 1:** engine, API/DB thật, lịch sử chạy, Copilot, Extract/Group, Docs panel, Kind/quan hệ giữa flow, và 23 node chưa thuộc đợt 1 (danh mục đầy đủ ở §6.2).

## 2. Thang ưu tiên mở rộng: config → plugin → customize

Quy tắc: thử cách nhẹ nhất trước, chỉ xuống bậc tiếp khi bậc trên **không làm được**. Kết quả kiểm chứng trên source `octop/` @ `890111b7`:

| Bậc | Octop cho phép gì | Dùng được cho trang Flows? | Bằng chứng |
|---|---|---|---|
| 1. **Config** | `config.json`: bật/tắt plugin (`plugins.<id>.enabled`), ngôn ngữ, giới hạn upload. Sidebar có `SidebarNavCustomizer` nhưng chỉ **ẩn/sắp xếp mục có sẵn** theo từng user. | **Không.** Không có khoá nào thêm trang hay mục sidebar. | `docs/configuration.md`; `layouts/sidebarNav.tsx`, `SidebarNavCustomizer.tsx` |
| 2. **Plugin** | `plugin.yaml` + `setup(ctx)` với `kind` = `tool` / `skill` / `hook` / `channel`. UI của plugin chỉ là **renderer kết quả tool trong chat** (`ui/dist/index.js`). | **Không.** Plugin không mount được FastAPI router, không thêm route/trang/sidebar. | `plugins/README.md`; `dashboard/src/plugins/toolRenderers/` (chỉ có thư mục này); `api/app.py:_mount_routers` nhận danh sách tĩnh `_RouterMount` |
| 3. **Customize** | Overlay trong `octop-orchester/`: file mới (`src/`) + patch tối thiểu vào file upstream. | **Có — bắt buộc** cho phần màn hình. | Cùng cơ chế agency / org-chart / webhook ([00-PATCH-REGISTRY §2](00-PATCH-REGISTRY.md)) |

**Hệ quả cho vòng 1:** toàn bộ là bậc 3. Giữ patch nhỏ nhất có thể (§8): mọi code mới nằm trong file mới; patch chỉ để nối vào sidebar, route, prefetch, locale, package.json.

**Hướng cho giai đoạn backend (chốt khi tới lúc, không quyết ở đây):** vẫn ưu tiên tái dùng thứ octop đã có thay vì xây hạ tầng mới.

| Nhu cầu | Ưu tiên tái dùng | Cần customize? |
|---|---|---|
| Trigger theo lịch | Cron của octop (`routers/cron.py`) | Chỉ nối vào |
| Trigger theo tin nhắn | Channels có sẵn | Chỉ nối vào |
| Node agent / kb_search | Agents/Experts, Knowledge bases có sẵn | Chỉ nối vào |
| Cho agent gọi flow | Plugin `kind: tool` (bậc 2) | Không |
| API + lưu flow + engine | Không có chỗ nào sẵn | Có — router + migration overlay (như webhook/agency) |

## 3. Kiểm kê chức năng Orchester Flows

Cột **Vòng**: `1` = làm ở vòng này · `sau` = giai đoạn sau · `bỏ` = không đưa sang.

### 3.1 Trang danh sách (`flows/FlowsListClient.tsx`, 469 dòng)

| # | Chức năng | Component / module Orchester | Vòng | Ghi chú cho Octop |
|---|---|---|---|---|
| L1 | Hero giải thích + thuật ngữ | `compass/PageHero`, `TermDef` | 1 (rút gọn) | Tiêu đề + mô tả ngắn, không tooltip thuật ngữ |
| L2 | Callout gợi ý lần đầu, tour | `compass/Callout`, `TourSpot` | bỏ | Hệ Compass là riêng của Orchester |
| L3 | Empty state | `compass/EmptyState` | 1 | antd `Empty` + nút tạo |
| L4 | Nhóm theo trạng thái active / paused / draft | `lib/flows/group-by-status.ts` | 1 | Port nguyên hàm thuần |
| L5 | Thẻ flow: tên, mô tả, số node, lần chạy cuối, badge | trong `FlowsListClient` | 1 | `FlowCard.tsx`; "lần chạy cuối" hiện `—` vì chưa có engine |
| L6 | Chọn template khi tạo | `compass/TemplatePicker`, `lib/flows/templates.ts` | 1 | 3 template mẫu: Trống, FAQ, Báo khi có tin nhắn |
| L7 | Tạo flow bằng prefill (nodes/edges/variables) | `use-template-create-flow.ts` | 1 | Tạo qua `flowApi.create(prefill)` |
| L8 | Xoá + hộp xác nhận | `DeleteFlowDialog` | 1 (đơn giản) | `Modal.confirm`; chưa có kiểm tra tác động |
| L9 | Kiểm tra tác động khi xoá | `lib/flows/delete-impact.ts`, `/api/flows/[id]/delete-impact` | sau | Cần dữ liệu quan hệ giữa flow |
| L10 | Lọc theo kind (pipeline/action) | `lib/flows/kind.ts`, `FlowKindPanel` | sau | |
| L11 | Chip quan hệ "ai gọi ai" | `FlowRelations`, `lib/flows/relations.ts` | sau | Cần subflow |
| L12 | Banner thiếu provider AI | `common/NoProviderBanner` | bỏ | |
| L13 | Gợi ý bước kế (`NextStep`) | `compass/NextStep` | bỏ | |

### 3.2 Trang builder (`flows/FlowBuilder.tsx`, 1855 dòng)

| # | Chức năng | Component / module Orchester | Vòng | Ghi chú cho Octop |
|---|---|---|---|---|
| B1 | Khung 3 cột + toolbar | `FlowBuilder` | 1 | Tách `Builder/index.tsx` + `useFlowEditor.ts` |
| B2 | Sửa tên tại chỗ, đổi trạng thái | trong toolbar | 1 | |
| B3 | Canvas xyflow: Background, Controls, MiniMap | `@xyflow/react` | 1 | Đã có lib nhờ patch org-chart |
| B4 | Node theo registry | `nodes/RegistryNode`, `SimpleNode`, `icon-map` | 1 | |
| B5 | Node rẽ nhánh (nhiều handle) | `nodes/BranchNode` | 1 | Cho `condition` |
| B6 | Palette: nhóm, tìm kiếm, kéo thả / click | `NodePalette` | 1 | |
| B7 | Inspector tự sinh từ registry | `inspector/InspectorForm` (715 dòng), `lib/flows/field-types.ts` | 1 (tập con field) | §6.3 |
| B8 | Field `spreadsheet` | `inspector/SpreadsheetField`, `spreadsheet-core.ts` | sau | Node `spreadsheet` chưa bật |
| B9 | Undo / redo | `historyRef` trong `FlowBuilder` | 1 | Trích thành hook |
| B10 | Copy / paste / nhân bản (Ctrl+C/V/D) | `FlowBuilder` | 1 | |
| B11 | Tidy layout tự động | `lib/flows/layout.ts` (dagre) | 1 | Layout phân tầng thuần, không dagre (§9) |
| B12 | Review / validate + panel lỗi | `ValidationPanel`, `lib/flows/validate.ts` | 1 | Port 4 quy tắc (thiếu trigger, thiếu field bắt buộc, cạnh gãy, node rời); 2 quy tắc còn lại của Orchester (thiếu tài liệu/purpose, ánh xạ subflow) làm cùng B23/subflow |
| B13 | Chuẩn hoá nodes/edges khi load | `lib/flows/normalize.ts`, `node-mapping.ts` | 1 | |
| B14 | Autosave + phát hiện dirty | `lib/flows/payload.ts` (`flowSignature`) | 1 | Lưu qua `flowApi.update` |
| B15 | Hướng dẫn canvas trống (4 trigger gợi ý) | `EmptyCanvasGuide` | 1 | |
| B16 | Biến của flow + dữ liệu khả dụng | `VariablesPanel`, `collectAvailableData`, `variable-facts.ts` | sau | Cần cú pháp `{{ }}` thống nhất với engine |
| B17 | Badge "bước AI" / bản chất node | `lib/flows/node-nature.ts` | sau | |
| B18 | Nút Run (có modal nhập dữ liệu, dry-run) | `RunInspector`, `lib/flows/run-inputs.ts`, `dry-run.ts` | sau | Vòng 1: nút hiện nhưng tắt, tooltip "cần engine" |
| B19 | Lịch sử chạy + trace từng bước | `FlowRunsPanel`, `/api/flow-runs/[id]` | sau | Đã loại khỏi vòng 1 theo yêu cầu |
| B20 | Copilot dựng flow bằng AI | `CopilotPanel`, `copilot-tools.ts`, `/api/flows/[id]/copilot` | sau | |
| B21 | Group node, Ctrl+G | `nodes/GroupNode`, `GroupDialog`, `lib/flows/groups.ts` | sau | |
| B22 | Extract thành subflow | `ExtractDialog`, `lib/flows/extract.ts` | sau | |
| B23 | Docs panel (spec của flow) | `FlowDocsPanel`, `node-docs.ts` | sau | |
| B24 | Kind settings | `FlowKindPanel`, `kind.ts` | sau | |
| B25 | Xoá flow từ builder | `DeleteFlowDialog` | 1 | Dùng lại hộp ở L8 |

### 3.3 Engine và backend (tham chiếu, để phân kỳ — không làm ở vòng 1)

`lib/flows/service.ts` (CRUD), `lib/flows/flow-repo.ts`, `flow-engine.ts` (1997 dòng; retry, subflow depth, pause/resume, run gate, step trace), `webhooks`, `versions.ts`, `pause.ts`/`resume.ts`, migrations `0055_flow_spec`, `0061_flow_step_trace`, `0062_flow_kind`, `0063_flow_groups`. Phân kỳ riêng, từng component, sau khi màn hình xong.

## 4. Thư viện UI: Orchester dùng gì, Octop dùng gì

| Mảng | Orchester (`apps/web`) | Octop (`dashboard`) | Quyết định cho Flows |
|---|---|---|---|
| Framework | Next.js 15, React 19 | Vite, React **18** | Viết lại component, không copy JSX nguyên |
| Component UI | `@heroui/react` | `antd` ^5.29 | **antd** |
| Style | Tailwind + `tailwind-merge`, `clsx` | `antd-style` + `*.module.less` | **less module**, theo mẫu các trang hiện có |
| Canvas | `@xyflow/react` ^12.11 | chưa có; patch org-chart thêm ^12.12 | **Dùng lại** bản đã thêm |
| Auto layout | `@dagrejs/dagre` | chưa có (không có trong lockfile) | **Không dùng**; layout phân tầng thuần cùng chữ ký `autoLayout` (§9) |
| Icon | `lucide-react` ^0.577 | `lucide-react` ^0.562 | Cùng lib; kiểm tra tên icon trong `icon-map` khi port |
| Toast | `sonner` | antd `message` | **antd `message`** |
| i18n | `next-intl` (es/en/pt) | `i18next` + `react-i18next` (en/zh, +vi qua overlay) | Đổi sang en/zh/vi; key mới `flows.*` |
| Theme | `next-themes` | `ThemeSwitcher` + token antd | Dùng token antd, không hard-code màu (trừ `accent` của node) |
| Router | `next/navigation` | `react-router-dom` ^7 | `useNavigate`, `useParams` |
| Data fetch | `fetch` + server component | module `api/modules/*.ts` + `request` | `api/modules/flows.ts` |
| Form | `react-hook-form` | state cục bộ + antd `Form` | antd `Form` |
| ID | `@paralleldrive/cuid2` | — | `crypto.randomUUID()` (không thêm dep) |
| Animation | `framer-motion` | — | Bỏ |
| Code editor (field `code`) | textarea | `@monaco-editor/react` | Monaco (sau, khi bật node `code`) |
| Validate schema | `zod` | — | Chưa cần ở vòng 1 (chỉ `groups.ts` dùng) |

## 5. Kiến trúc màn hình

### 5.1 Luồng

```
Sidebar "Flows" ──► /flows (danh sách)
                      ├─ "Thêm flow" ► modal: chọn Trống/Template + tên ► flowApi.create ► /flows/:flowId
                      └─ click thẻ ───────────────────────────────────► /flows/:flowId
Builder: nút ← quay lại /flows
```

### 5.2 Builder

```
┌ Toolbar: ← | tên | trạng thái | autosave | undo redo | tidy | validate | Save | Run(tắt) ┐
├ Palette ┬──────────── Canvas (xyflow) ─────────────┬ Inspector ┤
│ 5 nhóm  │ Background · Controls · MiniMap          │ form node │
│ tìm kiếm│ kéo thả / click để thêm node             │ đang chọn │
└─────────┴──────────────────────────────────────────┴───────────┘
 Overlay: ValidationPanel (nổi, đóng được) · EmptyCanvasGuide (khi canvas trống)
```

Giữ đúng bố cục Orchester: palette 224px bên trái, inspector bên phải, panel nổi dạng overlay.

## 6. Dữ liệu và registry

### 6.1 Mô hình dữ liệu

Giữ **shape lưu trữ của Orchester** (nodes / edges / variables) để port được `normalize` / `payload` và đối chiếu engine sau này:

```ts
type FlowStatus = "draft" | "active" | "paused";
interface FlowDTO {
  id: string; name: string; description: string | null;
  status: FlowStatus;
  nodes: StoredFlowNode[]; // {id, type(engine), label, config, position} — shape lưu của Orchester (normalize.ts)
  edges: StoredFlowEdge[]; // {id, source, target, sourceHandle?, label?}
  variables: Record<string, unknown>;
  createdAt: string; updatedAt: string;
}
interface FlowApi {
  list(): Promise<FlowSummary[]>;            // + nodeCount
  get(id: string): Promise<FlowDTO>;
  create(input: {name; description?; nodes?; edges?; variables?}): Promise<FlowDTO>;
  update(id: string, patch: Partial<FlowDTO>): Promise<FlowDTO>;
  remove(id: string): Promise<void>;
}
```

Cài đặt vòng 1: `mockFlowApi` lưu trong `localStorage` (bọc try/catch, rơi về bộ nhớ khi bị chặn). Khi có backend, thay bằng `httpFlowApi` — UI không đổi.

### 6.2 Danh mục đầy đủ 31 node của Orchester

Trích trực tiếp từ `lib/flows/node-registry.ts`. Ký hiệu field: `*` bắt buộc, `~` nằm trong mục "Nâng cao". Cột **Đợt**: **1** = làm ở vòng này (§6.3) · **2** = logic/điều khiển, field đơn giản · **3** = cần picker mô hình/KB/integration. Cột **Điểm nối Octop** là module API đã có trong `dashboard/src/api/modules/` để cân nhắc khi làm backend (chưa kiểm chứng ở mức engine).

**Triggers (4)**

| Node | Engine | Tên (en) | Làm gì | Field | Điểm nối Octop | Đợt |
|---|---|---|---|---|---|---|
| `trigger_manual` | trigger | Manual start | Chạy tay hoặc qua API | — | — | 1 |
| `trigger_message` | trigger | When a message arrives | Chạy khi khách nhắn trên một kênh | `channelId`:channel-picker | `channel.ts` | 1 |
| `trigger_schedule` | trigger | On a schedule | Chạy lặp theo lịch | `cron`:cron* | `cronjob.ts` | 1 |
| `trigger_webhook` | trigger | When a webhook arrives | Chạy khi app khác gọi URL | — | (inbound webhook chưa có; `webhooks` của octop là outbound) | 2 |

**AI (9)**

| Node | Engine | Tên (en) | Làm gì | Field | Điểm nối Octop | Đợt |
|---|---|---|---|---|---|---|
| `agent` | agent | Agent | Gửi tin cho một AI agent, dùng câu trả lời | `agentId`:agent-picker*, `prompt`:textarea | `octopAgents.ts` | 1 |
| `kb_search` | kb_search | Search knowledge | Tìm thông tin trong knowledge base | `kbId`:kb-picker*, `query`:variable*, `topK`:number~ | `knowledgeBases.ts` | 3 |
| `llm_prompt` | llm_prompt | Generate text (AI) | Đưa prompt cho model, nhận text (không cần agent) | `model`:model-picker*, `prompt`:variable*, `system`:textarea~, `temperature`:number~, `outputVar`:text~ | `provider.ts` | 3 |
| `generate_image` | generate_image | Create image | Tạo ảnh từ prompt | `model`:model-picker*, `prompt`:variable*, `size`:select~, `outputVar`:text~ | `mediaGeneration.ts` | 3 |
| `generate_video` | generate_video | Create video (AI) | Tạo video ngắn từ prompt | `model`:model-picker*, `prompt`:variable*, `outputVar`:text~ | `mediaGeneration.ts` | 3 |
| `text_to_speech` | text_to_speech | Text to speech | Đọc text thành giọng nói | `model`:model-picker*, `text`:variable*, `voice`:text~, `outputVar`:text~ | `voice.ts` | 3 |
| `transcribe` | transcribe | Transcribe audio | Chuyển audio thành text | `model`:model-picker*, `audioUrl`:variable*, `outputVar`:text~ | `voice.ts` | 3 |
| `generate_avatar` | generate_avatar | Talking avatar | Tạo video người nói một đoạn text | `model`:model-picker*, `text`:variable*, `avatarId`:text~, `imageUrl`:variable~, `voiceId`:text~, `outputVar`:text~ | `mediaGeneration.ts` | 3 |
| `generate_music` | generate_music | Create music | Tạo nhạc/âm thanh từ prompt | `model`:model-picker*, `prompt`:variable*, `outputVar`:text~ | `mediaGeneration.ts` | 3 |

**Logic (6)**

| Node | Engine | Tên (en) | Làm gì | Field | Đợt |
|---|---|---|---|---|---|
| `condition` | condition | If… then | Rẽ nhánh theo điều kiện (true/false) | `left`:variable*, `op`:select*, `right`:text* | 1 |
| `switch` | switch | Pick a path | Chọn một trong nhiều đường theo giá trị | `value`:variable*, `cases`:string-list | 2 |
| `loop_for_each` | loop_for_each | Repeat for each | Chạy các bước kế tiếp cho từng phần tử | `items`:variable* | 2 |
| `parallel` | parallel | In parallel | Làm nhiều việc cùng lúc | — | 2 |
| `try_catch` | try_catch | Try / on error | Thử; lỗi thì đi đường khác | — | 2 |
| `code` | code | Code (advanced) | Chạy JavaScript tuỳ chỉnh (cho dev) | `code`:code | 2 |

**Connect apps (2)**

| Node | Engine | Tên (en) | Làm gì | Field | Điểm nối Octop | Đợt |
|---|---|---|---|---|---|---|
| `http` | http | Call an API (HTTP) | Gọi web service bằng URL | `url`:text*, `method`:select, `headers`:key-value~, `body`:json~, `failOnStatus`:boolean~, `retry`:json~ | — | 1 |
| `integration` | integration | Connect an app | Dùng một integration (Stripe, Notion, Slack…) | `integrationId`:integration-action*, `input`:key-value, `retry`:json~ | `connectors.ts` | 3 |

**Data (5)**

| Node | Engine | Tên (en) | Làm gì | Field | Điểm nối Octop | Đợt |
|---|---|---|---|---|---|---|
| `transform` | transform | Modify data | Dựng/biến đổi dữ liệu cho bước sau | `template`:json* | — | 2 |
| `spreadsheet` | spreadsheet | Spreadsheet / formulas | Công thức kiểu Excel (SUM, IF, VLOOKUP…) | `grid`:spreadsheet | — | 3 |
| `embed_text` | embed_text | Vectorize / embeddings | Biến text thành vector cho tìm kiếm ngữ nghĩa | `model`:model-picker*, `input`:variable*, `outputVar`:text~ | `embedding.ts` | 3 |
| `rerank` | rerank | Rerank by relevance | Xếp hạng danh sách text theo độ liên quan | `model`:model-picker*, `query`:variable*, `documents`:variable*, `topN`:number~, `outputVar`:text~ | `embedding.ts` | 3 |
| `ocr_extract` | ocr_extract | Read document (OCR) | Trích text từ PDF/ảnh scan | `model`:model-picker*, `documentUrl`:variable*, `outputVar`:text~ | — | 3 |

**Actions (5)**

| Node | Engine | Tên (en) | Làm gì | Field | Điểm nối Octop | Đợt |
|---|---|---|---|---|---|---|
| `delay` | delay | Wait a bit | Tạm dừng một lúc rồi chạy tiếp | `duration`:duration* | — | 2 |
| `notify` | notify | Notify | Gửi thông báo (email/tin nhắn) cho ai đó | `to`:text*, `message`:textarea* | `channel.ts` | 1 |
| `wait_human` | wait_human | Wait for a person | Dừng đến khi có người duyệt/trả lời | `instructions`:textarea | — (chưa thấy cơ chế duyệt bởi người; xét khi làm backend) | 2 |
| `subflow` | subflow | Sub-flow | Chạy một flow đã lưu như một bước | `flowId`:text*, `inputs`:key-value, `outputs`:key-value | — | 2 |
| `note` | note | Note | Ghi chú giải thích flow (không làm gì) | `text`:textarea | — | 1 |

Tổng: đợt 1 = 8 · đợt 2 = 10 · đợt 3 = 13 (cộng 31). Engine chỉ có 29 loại vì 4 trigger dùng chung engine `trigger` (phân biệt bằng `fixedConfig.triggerKind`).

**Cách thêm node:** thêm một entry vào registry (+ executor ở engine khi tới giai đoạn backend), không sửa UI. Palette, inspector và validate đều sinh từ registry.

**Hiển thị trong palette** (Octop): vòng 1 chỉ hiện node đợt 1; đợt 2/3 vào palette khi component field tương ứng làm xong (§7, C8/C9), để không có node mà inspector chưa cấu hình được.

### 6.3 Node đợt 1 (8 node, vòng này)

| Nhóm | Node (id registry) | Engine | Field inspector |
|---|---|---|---|
| Trigger | `trigger_manual` | trigger | — |
| Trigger | `trigger_message` | trigger | `channelId` (`channel-picker`) |
| Trigger | `trigger_schedule` | trigger | `cron` (`cron`, bắt buộc) |
| AI | `agent` | agent | `agentId` (`agent-picker`, bắt buộc), `prompt` (`textarea`) |
| Logic | `condition` | condition | `left` (`variable`, bắt buộc), `op` (`select`, bắt buộc), `right` (`text`, bắt buộc); rẽ nhánh true/false |
| Apps | `http` | http | `url` (`text`, bắt buộc), `method` (`select`), `headers` (`key-value`), `body` (`json`), `failOnStatus` (`boolean`), `retry` (`json`) |
| Actions | `notify` | notify | `to` (`text`, bắt buộc), `message` (`textarea`, bắt buộc) |
| Actions | `note` | note | `text` (`textarea`) |

Các field trên đã đối chiếu với `node-registry.ts`. Nhóm **Data** chưa có node nào được bật ở vòng 1 (các node `transform`, `spreadsheet`, `embed_text`… nằm ngoài danh sách), nên palette hiển thị 5 nhóm; nhóm Data xuất hiện khi bật node đầu tiên của nó.

Field type bật ở vòng 1: `text`, `textarea`, `number`, `boolean`, `select`, `key-value`, `json`, `cron`, `variable` (vòng 1 render như ô nhập text; gợi ý biến làm cùng B16), `channel-picker`, `agent-picker`. Các loại còn lại (`kb-picker`, `model-picker`, `integration-action`, `spreadsheet`, `code`, `duration`, `string-list`) khai báo kiểu nhưng chưa render.

Picker lấy dữ liệu thật của Octop ngay cả ở vòng 1 (read-only, không cần backend mới): `agent-picker` ← `api/modules/octopAgents.ts`, `channel-picker` ← `api/modules/channel.ts`. Component nhập cron: kiểm tra có tái dùng được từ `pages/Control/CronJobs` không — chốt ở bước C6.

Nhóm trong registry: Triggers · AI · Logic · Connect apps · Data · Actions (nhãn dịch en/zh/vi); palette chỉ hiện nhóm có node được bật.

## 7. Kế hoạch triển khai từng component và trạng thái

Mỗi bước: viết test trước → làm → chạy test/lint/build → **dừng cho bạn duyệt** → bước kế. Trạng thái chi tiết và cách tiếp tục: [05-FLOWS-NODE-GUIDE §1](05-FLOWS-NODE-GUIDE.md).

| Bước | Component | Trạng thái | Ghi chú |
|---|---|---|---|
| C0 | Khung: route, sidebar, i18n, `flowApi` mock, whitelist backend | **Xong** | Plan [list + create](superpowers/plans/2026-10-30-flows-list-and-create.md) |
| C1 | Trang danh sách | **Xong** | |
| C2 | Thêm flow (mẫu Trống/FAQ/Báo tin) | **Xong** | |
| C3 | Khung builder: toolbar, 3 cột, tải/lưu | **Xong** | Plan [khung builder](superpowers/plans/2026-10-30-flows-builder.md) Task 2 |
| C4 | Canvas + thẻ node + nối dây | **Xong** | Thẻ node chung (`NodeCard`); thẻ dự phòng cho node ngoài catalog |
| C5 | Palette | **Xong** | Luôn hiện 6 nhóm; catalog rỗng nên chưa có mục |
| C6 | Inspector | **Khung xong** | Tên + xoá + chỗ cắm `renderFields`; field theo từng node làm cùng node |
| C7 | Undo/redo, copy/paste, tidy, kiểm tra lỗi, autosave | **Chưa làm** | Plan khung builder Task 6 |
| Node | Từng node: catalog + palette + thẻ + field + validate + test | **Chưa có node nào** | Đợt 1 → 2 → 3 theo §6.2; khuôn mẫu: [05 §3](05-FLOWS-NODE-GUIDE.md) |
| Backend | API/DB/engine/lịch sử chạy | Chưa làm | §2 (bảng tái dùng cron/channels/agents), §3.3 |

Điều chỉnh so với bản thiết kế đầu: tidy layout không dùng dagre; nút Chạy hiện nhưng tắt; chỉ 4 quy tắc validate lúc đầu (§3.2 B12); node làm từng cái một thay vì C8/C9 theo đợt.

## 8. Cấu trúc folder và điểm patch

```
octop-orchester/
├── src/dashboard/src/                              ← FILE MỚI (toàn bộ code Flows)
│   ├── api/modules/flows.ts(+test)                 FlowApi, createMockFlowApi (localStorage), flowApi, newId
│   └── pages/Flows/
│       ├── index.tsx, index.module.less            /flows (danh sách) và /flows/:flowId (→ FlowBuilder)
│       ├── components/{FlowCard,CreateFlowModal}.tsx(+test)
│       ├── lib/                                    logic thuần, có test
│       │   ├── group-by-status.ts, templates.ts    danh sách / mẫu khi thêm flow
│       │   ├── node-types.ts, field-types.ts       29 engine type, kiểu field
│       │   ├── node-catalog.ts                     NODE_REGISTRY (RỖNG, mỗi node thêm một entry) + getNodeDef/list…
│       │   ├── normalize.ts, node-mapping.ts, payload.ts   lưu ↔ canvas, chữ ký autosave
│       │   ├── graph.ts, layout.ts, validate.ts    thêm/xoá/nối node, tidy, kiểm tra lỗi
│       │   └── node-copy.test.ts                   mọi node trong catalog có copy 3 ngôn ngữ
│       ├── Builder/
│       │   ├── index.tsx, index.module.less        khung: toolbar + palette | canvas | inspector
│       │   ├── useFlowEditor.ts                    state + hành động của builder
│       │   ├── Toolbar.tsx, Canvas.tsx, EmptyCanvasGuide.tsx
│       │   ├── NodePalette.tsx, Inspector.tsx      (renderFields: chỗ cắm form field của node)
│       │   └── nodes/{NodeCard.tsx,icon-map.ts,nodes.module.less}
│       └── navigation.test.ts                      sidebar/route đã áp patch
├── patches/                                        ← PATCH tối thiểu (id workflow-ui)
│   ├── dashboard/src/layouts/sidebarNav.tsx.workflow-ui.patch
│   ├── dashboard/src/layouts/sidebarNavLayout.test.ts.workflow-ui.patch
│   ├── dashboard/src/routes/index.tsx.workflow-ui.patch
│   ├── dashboard/src/routes/prefetch.ts.workflow-ui.patch
│   ├── dashboard/src/locales/{en,zh}.json.workflow-ui.patch      sinh bằng regen_flows_locale_patches.py
│   └── src/octop/infra/users/preferences.py.workflow-ui.patch    whitelist SIDEBAR_NAV_KEYS
└── scripts/
    ├── add_flows_i18n.py                           COPY en/zh/vi của Flows (+ --check)
    ├── regen_flows_locale_patches.py               sinh lại patch en/zh + vi.json từ COPY
    └── dashboard_test.sh (--tsc, --lint) · dashboard_format.sh
```

- **Patch backend duy nhất ở vòng 1:** `preferences.py` — whitelist `SIDEBAR_NAV_KEYS` ở server phải có khoá `flows`, nếu không lưu layout sidebar có mục Flows bị từ chối (agency và org-chart đều đã phải làm vậy). Không đụng `app.py`, không migration.
- Mục sidebar dùng cùng gate `if (user)` như Agencies / Org chart, không thêm khoá quyền.
- **Patch id là `workflow-ui`, không phải `flows`.** `patch_status.py` và Dockerfile áp patch theo thứ tự tên file; id `flows` xếp trước `org-chart` và làm hỏng context patch org-chart, còn `workflow-ui` xếp sau. Id này cũng chừa chỗ cho `workflow-api` ở giai đoạn backend.
- Thứ tự áp patch: `agency` → `org-chart` → `workflow-ui`. Patch `workflow-ui` sinh trên kết quả của hai patch trước (sidebarNav, routes, prefetch, locales đã bị chúng sửa), nên phải đăng ký vào `manifest.yaml` và chạy `scripts/patch_status.py --record` khi triển khai.

## 9. Rủi ro và câu hỏi mở

**Đã chốt (2026-10-30, ghi ở plan builder):**
1. **Tidy layout: không dùng dagre.** `@dagrejs/dagre` không có trong lockfile của octop; thêm nó phải patch `package.json` + `package-lock.json` (giòn, cần mạng để sinh lock). Dùng layout phân tầng thuần như org-chart, giữ chữ ký `autoLayout` của Orchester nên đổi sang dagre sau chỉ là thay thân hàm.
2. **Nút Run ở vòng 1:** hiện nhưng tắt, tooltip "cần engine".

**Rủi ro:**
- Sidebar/routes/locales đã bị 3 patch chạm; patch thứ 4 dễ lệch khi upstream đổi. Giảm thiểu: giữ mỗi patch vài dòng, chạy `patch_status.py` sau mỗi lần cập nhật octop.
- Patch `package-lock.json` giòn; chỉ phát sinh nếu chọn dagre.
- Tên icon `lucide-react` khác phiên bản (0.562 vs 0.577): kiểm tra `icon-map` ở C4.
- Dữ liệu mock nằm ở `localStorage` từng trình duyệt: chỉ để duyệt UI, không phải nơi lưu thật.
- Port `FlowBuilder` 1855 dòng sang hook + component nhỏ dễ lạc hành vi; vì vậy test cho phần logic thuần (normalize/validate/undo) viết trước khi nối UI.

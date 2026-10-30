# Flows — Danh sách + Thêm flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Octop có mục sidebar **Flows**, trang danh sách flow (nhóm theo trạng thái) và luồng thêm flow (chọn template + tên), chạy trên dữ liệu giả sau interface `flowApi`.

**Architecture:** Toàn bộ code mới là file overlay trong `octop-orchester/src/dashboard/src/`, theo đúng mẫu trang Agencies (một component route xử lý `/flows` và `/flows/:flowId`). Chỉ 7 patch tối thiểu nối vào upstream (sidebar, route, prefetch, 2 locale, 1 test sidebar, 1 whitelist backend). Dữ liệu qua `flowApi`; vòng này cài bằng `localStorage`, sau này thay bằng HTTP mà UI không đổi.

**Tech Stack:** React 18, antd 5, `antd-style`/less module, react-router-dom 7, react-i18next, lucide-react, vitest + Testing Library. Không thêm dependency.

**Spec:** [`octop-orchester/docs/04-FLOWS-ARCHITECTURE.md`](../../04-FLOWS-ARCHITECTURE.md) (§5 màn hình, §6.1 dữ liệu, §7 C0–C2, §8 patch).

> **Trạng thái: HOÀN THÀNH (2026-10-30).** Cả 4 task đã làm xong, build và chạy ở http://localhost:9088 (menu **Luồng tự động**). Tiếp theo: [`2026-10-30-flows-builder.md`](2026-10-30-flows-builder.md); hướng dẫn tiếp tục: [`../../05-FLOWS-NODE-GUIDE.md`](../../05-FLOWS-NODE-GUIDE.md).
>
> Khác plan khi triển khai: Task 3 và 4 làm liền nhau (người dùng cần thấy nội dung); hàm `load` của trang danh sách không phụ thuộc `t` (tránh tải lại vô hạn); form thêm flow dùng `preserve={false}` để reset khi mở lại; thêm `browserStorage()` vào `flows.ts` (đọc `window.localStorage` cũng có thể ném lỗi). Các bước "dừng duyệt" và commit gợi ý trong plan này đã được thay bằng một commit tổng.

## Phạm vi

Plan này = C0 + C1 + C2 của spec. **Không có trong plan:** builder, canvas, palette, inspector, node registry, lịch sử chạy, backend/engine. Trang `/flows/:flowId` chỉ là placeholder (tên flow + nút quay lại) để luồng "tạo → mở" chạy được; C3 thay nó bằng builder.

Hai thay đổi so với spec, đã cập nhật vào spec cùng lúc viết plan:
- **Node registry không làm ở đây** (dời sang plan builder/node). Template viết thẳng dạng stored node; task node sau này thêm test "mọi node của template đều có trong registry".
- **Có patch backend `preferences.py`**: whitelist `SIDEBAR_NAV_KEYS` ở server phải có khoá `flows`, nếu không lưu layout sidebar có mục Flows sẽ bị từ chối (agency và org-chart đều đã phải làm vậy).

## Global Constraints

- UI chỉ dùng **antd + less module + lucide-react**; không Tailwind, HeroUI, framer-motion, sonner. Toast qua `message` từ `@/utils/antdMessage`, hộp xác nhận qua `modal` từ `@/utils/antdModal`.
- Không thêm dependency; không đụng `package.json` / lock.
- Mục sidebar gate bằng `if (user)` (không thêm khoá quyền), đặt **ngay sau `org-chart`**; icon lucide `Workflow`; `labelKey: "nav.flows"`; `key: "flows"`; `path: "/flows"`.
- Route: `/flows` và `/flows/:flowId`, cùng một component lazy `pages/Flows`.
- Patch id **`workflow-ui`** (không phải `flows`): `scripts/patch_status.py` áp patch theo thứ tự tên file, và id này xếp sau `org-chart` nên context của nó đã chứa phần org-chart thêm vào. Id `flows` sẽ xếp trước `org-chart` và làm hỏng context của chính patch org-chart.
- Tên patch: `patches/<đường dẫn từ gốc octop>.workflow-ui.patch`; mỗi file một patch; không có `--- /dev/null`.
- Trạng thái flow chỉ gồm `draft | active | paused`; nhóm hiển thị theo thứ tự **active, paused, draft**; flow mới tạo luôn `draft`.
- Tên flow: bắt buộc, bỏ khoảng trắng đầu/cuối, tối đa **64** ký tự. Mô tả tối đa 500.
- Khoá lưu trữ giả: `octop.flows.v1`. Mọi thao tác `localStorage` bọc try/catch, rơi về bộ nhớ khi lỗi.
- i18n en/zh/vi đều có đủ key trước khi task dùng chúng; component không truyền `count` vào `t()` (render số trong JSX, như Agencies).
- File locale `en.json`/`zh.json` upstream là **CRLF**; không để diff lan ra cả file (dùng script, bảo toàn byte).
- Không commit nếu người dùng chưa yêu cầu; cuối mỗi task **dừng chờ duyệt**.

## Review Focus

Các đầu vào mà spec không nói tới nhưng dễ vỡ nhất (mỗi dòng có test ở task sở hữu):

1. `localStorage` ném lỗi (cửa sổ ẩn danh) → danh sách vẫn tạo/đọc được trong phiên (Task 1).
2. Dữ liệu `localStorage` hỏng/không phải JSON hợp lệ → coi như rỗng, không crash trang (Task 1).
3. Mở `/flows/<id không tồn tại>` → hiện empty state "không tìm thấy" kèm nút quay lại, không crash (Task 3).
4. Xoá flow cuối cùng → quay về empty state; bấm Huỷ ở hộp xác nhận → flow còn nguyên (Task 3).
5. Tên chỉ toàn khoảng trắng hoặc dài hơn 64 ký tự → form chặn, không gọi `flowApi.create` (Task 4).

---

## File Structure

```
octop-orchester/
├── src/dashboard/src/                          (file mới — overlay)
│   ├── api/modules/flows.ts                    types + FlowApi + createMockFlowApi + flowApi        [T1]
│   ├── api/modules/flows.test.ts                                                                    [T1]
│   ├── pages/Flows/index.tsx                   route component: list view + detail placeholder      [T2 shell, T3 list, T4 create]
│   ├── pages/Flows/index.module.less           styles (lấy class từ Agencies/index.module.less)     [T3]
│   ├── pages/Flows/index.test.tsx                                                                   [T3]
│   ├── pages/Flows/navigation.test.ts          kiểm tra patch sidebar/route đã áp                   [T2]
│   ├── pages/Flows/lib/group-by-status.ts(+test)                                                    [T3]
│   ├── pages/Flows/lib/templates.ts(+test)                                                          [T4]
│   ├── pages/Flows/components/FlowCard.tsx(+test)                                                   [T3]
│   ├── pages/Flows/components/CreateFlowModal.tsx(+test)                                            [T4]
│   └── locales/vi.json                         (sửa — overlay, thêm key)                            [T2]
├── patches/                                    (7 patch mới, id workflow-ui)                        [T2]
│   ├── dashboard/src/layouts/sidebarNav.tsx.workflow-ui.patch
│   ├── dashboard/src/layouts/sidebarNavLayout.test.ts.workflow-ui.patch
│   ├── dashboard/src/routes/index.tsx.workflow-ui.patch
│   ├── dashboard/src/routes/prefetch.ts.workflow-ui.patch
│   ├── dashboard/src/locales/en.json.workflow-ui.patch
│   ├── dashboard/src/locales/zh.json.workflow-ui.patch
│   └── src/octop/infra/users/preferences.py.workflow-ui.patch
├── scripts/add_flows_i18n.py                   (mới)   scripts/dashboard_test.sh (thêm cờ --tsc)
├── scripts/vi-i18n/check_parity.py             (sửa: thêm prefix "flows." và key "nav.flows")
└── patches/manifest.yaml, patches/lock.json, docs/00-PATCH-REGISTRY.md   (đăng ký patch)
```

Mọi lệnh dưới đây chạy từ **gốc repo** (`octop-orgchester/`) trong Git Bash. Chạy test: `bash octop-orchester/scripts/dashboard_test.sh <đường dẫn vitest>` (Docker dựng bản overlay đã áp patch rồi chạy vitest; lần đầu chậm vì `npm ci`).

---

### Task 1: Lớp dữ liệu `flowApi` (mock localStorage)

**Files:**
- Create: `octop-orchester/src/dashboard/src/api/modules/flows.ts`
- Test: `octop-orchester/src/dashboard/src/api/modules/flows.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces (các task sau import đúng các tên này):
  ```ts
  export type FlowStatus = "draft" | "active" | "paused";
  export interface StoredFlowNode { id: string; type: string; label: string;
    config: Record<string, unknown>; position: { x: number; y: number } }
  export interface StoredFlowEdge { id: string; source: string; target: string;
    sourceHandle?: string; label?: string }
  export interface FlowDTO { id: string; name: string; description: string | null;
    status: FlowStatus; nodes: StoredFlowNode[]; edges: StoredFlowEdge[];
    variables: Record<string, unknown>; createdAt: string; updatedAt: string }
  export interface FlowSummary { id: string; name: string; description: string | null;
    status: FlowStatus; nodeCount: number; updatedAt: string }
  export interface FlowCreateInput { name: string; description?: string | null;
    nodes?: StoredFlowNode[]; edges?: StoredFlowEdge[]; variables?: Record<string, unknown> }
  export type FlowUpdateInput = Partial<Pick<FlowDTO,
    "name" | "description" | "status" | "nodes" | "edges" | "variables">>;
  export interface FlowApi {
    list(): Promise<FlowSummary[]>;               // mới/sửa gần nhất đứng đầu
    get(id: string): Promise<FlowDTO>;            // id lạ → reject Error("flow not found")
    create(input: FlowCreateInput): Promise<FlowDTO>;   // status "draft", id mới
    update(id: string, patch: FlowUpdateInput): Promise<FlowDTO>; // bump updatedAt; id lạ → reject
    remove(id: string): Promise<void>;            // id lạ → reject
  }
  export const FLOWS_STORAGE_KEY = "octop.flows.v1";
  export function createMockFlowApi(storage?: Pick<Storage, "getItem" | "setItem">): FlowApi;
  export const flowApi: FlowApi;                  // createMockFlowApi() dùng window.localStorage
  ```

- [x] **Step 1: Viết test (đỏ).** `flows.test.ts`, mỗi `it` dùng một `storage` giả dựng bằng `Map` và `createMockFlowApi(storage)`; dùng `vi.useFakeTimers()` + `vi.setSystemTime` để kiểm thứ tự. Các test:
  - `"list is empty on a fresh store"` → `await api.list()` bằng `[]`.
  - `"create stores a draft with defaults"` → `create({ name: "A" })` trả `status: "draft"`, `description: null`, `nodes: []`, `edges: []`, `variables: {}`, `id` không rỗng, `createdAt === updatedAt`.
  - `"list returns summaries newest first with nodeCount"` → tạo A (t0), B (t0+1s, 2 node) → `list()` map `name` = `["B","A"]` và B có `nodeCount: 2`.
  - `"update bumps updatedAt and moves the flow to the top"` → update A thành `status: "active"` sau t0+2s → A đứng đầu, `status` đổi, `get(A.id).updatedAt` mới hơn.
  - `"get/update/remove reject for an unknown id"` → cả ba `rejects.toThrow("flow not found")`.
  - `"remove deletes the flow"` → sau `remove`, `list()` rỗng.
  - **Review Focus 2** `"corrupt stored JSON is treated as empty"` → `storage.setItem(FLOWS_STORAGE_KEY, "{not json")` rồi `list()` bằng `[]` và `create({name:"A"})` vẫn thành công.
  - **Review Focus 1** `"falls back to memory when storage throws"` → `storage` có `getItem`/`setItem` đều `throw new Error("denied")`; `create` rồi `list` vẫn thấy flow vừa tạo trong cùng instance.

- [x] **Step 2: Chạy test, xác nhận đỏ.**
  Run: `bash octop-orchester/scripts/dashboard_test.sh src/api/modules/flows.test.ts`
  Expected: FAIL (`Failed to resolve import "./flows"`).

- [x] **Step 3: Cài `flows.ts`** theo khối Interfaces ở trên. Cách làm: một `load()/save()` đọc/ghi toàn bộ mảng `FlowDTO[]` dưới `FLOWS_STORAGE_KEY` (JSON; `try/catch` → rơi về biến `memory` trong closure; dữ liệu không phải mảng → `[]`); `id` = `crypto.randomUUID()` nếu có, không thì chuỗi ngẫu nhiên base36; thứ tự list = `updatedAt` giảm dần, hoà thì phần tử thêm/sửa sau đứng trước. `flowApi = createMockFlowApi(typeof window !== "undefined" ? window.localStorage : undefined)`.

- [x] **Step 4: Chạy test, xác nhận xanh.**
  Run: `bash octop-orchester/scripts/dashboard_test.sh src/api/modules/flows.test.ts`
  Expected: 8 passed.

- [x] **Step 5: Dừng cho người dùng duyệt Task 1.** (Commit gợi ý khi được yêu cầu: `feat(flows): add flowApi with localStorage mock`.)

---

### Task 2: Khung — route, sidebar, i18n, whitelist backend, trang rỗng (C0)

**Files:**
- Create: `src/dashboard/src/pages/Flows/index.tsx`, `src/dashboard/src/pages/Flows/navigation.test.ts`, `scripts/add_flows_i18n.py` (đều dưới `octop-orchester/`)
- Create: 7 patch `workflow-ui` (xem File Structure)
- Modify: `src/dashboard/src/locales/vi.json`, `scripts/dashboard_test.sh`, `scripts/vi-i18n/check_parity.py`, `patches/manifest.yaml`, `patches/lock.json`, `docs/00-PATCH-REGISTRY.md` (đều dưới `octop-orchester/`)

**Interfaces:**
- Consumes: không có từ Task 1.
- Produces:
  - Mục sidebar `{ key: "flows", path: "/flows", labelKey: "nav.flows" }` sau `org-chart`; `pathToKey["/flows"] = "flows"`; `routeConfigs` có `/flows` và `/flows/:flowId`; `ROUTE_PREFETCHERS["/flows"]`.
  - `export default function FlowsPage()` ở `pages/Flows/index.tsx` (Task 2 chỉ render `PageShell` với `t("flows.title")`/`t("flows.subtitle")`).
  - Bộ key i18n `flows.*` và `nav.flows` trong en/zh/vi — **toàn bộ key các task 3–4 dùng** (bảng dưới). Script idempotent theo nhóm nên khai báo đủ ngay lần này.

  | Nhóm | Key (dưới `flows.`) |
  |---|---|
  | Trang | `title`, `subtitle`, `create`, `searchPlaceholder`, `empty`, `emptyHint`, `loadFailed`, `back`, `notFound`, `notFoundHint`, `builderSoon`, `stepCount`, `updatedAt` |
  | Trạng thái | `status.active`, `status.paused`, `status.draft` |
  | Thẻ | `actions.more`, `actions.setActive`, `actions.setPaused`, `actions.setDraft`, `delete`, `deleteConfirm`, `deleteConfirmDesc`, `cancel`, `deleteFailed`, `statusFailed` |
  | Modal thêm | `createTitle`, `template`, `name`, `namePlaceholder`, `description`, `descriptionPlaceholder`, `save`, `saveFailed`, `created` |
  | Template | `templates.blank.{name,description}`, `templates.faq.{name,description,nodes.trigger,nodes.agent}`, `templates.alert.{name,description,nodes.trigger,nodes.notify}` |

- [x] **Step 1: Viết test điều hướng (đỏ).** `navigation.test.ts` import `buildNavSections` từ `../../layouts/sidebarNav` và `pathToKey`, `routeConfigs` từ `../../routes`; `adminUser` như trong `sidebarNav.test.ts`. Test:
  - `"adds Flows right after Org chart for a signed-in user"` → danh sách key phẳng của `buildNavSections(adminUser, { mobileEnabled: true })` có `"flows"` ngay sau `"org-chart"`; item đó có `path "/flows"`, `labelKey "nav.flows"`.
  - `"hides Flows when signed out"` → `buildNavSections(null, { mobileEnabled: true })` không có key `"flows"`.
  - `"routes /flows and /flows/:flowId to the same page"` → `routeConfigs.map(r => r.path)` chứa cả hai; `pathToKey["/flows"] === "flows"`.

- [x] **Step 2: Tạo `pages/Flows/index.tsx` tối thiểu** (`FlowsPage` render `PageShell` với title/subtitle, chưa có nội dung). Chạy test điều hướng.
  Run: `bash octop-orchester/scripts/dashboard_test.sh src/pages/Flows/navigation.test.ts`
  Expected: FAIL (không có mục `flows`, route chưa có).

- [x] **Step 3: Dựng worktree upstream để sinh patch.**
  ```bash
  REPO="$(pwd)"                      # gốc repo octop-orgchester/
  WT=/tmp/octo-flows-wt
  git -c core.autocrlf=false -C octop worktree add --detach "$WT" HEAD
  for p in $(find "$REPO/octop-orchester/patches/dashboard" "$REPO/octop-orchester/patches/src" \
                  -name '*.patch' | sort); do
    git -C "$WT" apply --whitespace=nowarn "$p"; done   # áp mọi patch hiện có
  git -C "$WT" add -A                # chốt baseline: git diff sau đó chỉ chứa phần của workflow-ui
  ```
  Expected: không lỗi `git apply`. (`workflow-ui` xếp sau mọi id hiện có nên áp toàn bộ patch cũ là đúng baseline.)

- [x] **Step 4: Sửa 5 file code trong worktree** (Edit trực tiếp, giữ nguyên kiểu xuống dòng):
  - `dashboard/src/layouts/sidebarNav.tsx`: import `Workflow` từ `lucide-react` (cạnh `Network`); thêm `"flows"` vào `SIDEBAR_NAV_KEYS` ngay sau `"org-chart"`; trong `buildNavSections` thêm khối `if (user) { topItems.push({ key: "flows", path: "/flows", icon: <Workflow size={iconSize} strokeWidth={iconStroke} />, labelKey: "nav.flows" }); }` ngay sau khối org-chart, kèm comment một dòng giống khối org-chart.
  - `dashboard/src/layouts/sidebarNavLayout.test.ts`: thêm `"flows"` sau `"org-chart"` trong mảng `editor.ungrouped` mong đợi.
  - `dashboard/src/routes/index.tsx`: `const FlowsPage = lazy(() => import("../pages/Flows"));` sau dòng `OrgChartPage`; `"/flows": "flows"` trong `pathToKey` sau `"/org-chart"`; hai route `{ path: "/flows", element: <FlowsPage /> }` và `{ path: "/flows/:flowId", element: <FlowsPage /> }` sau route `/org-chart`.
  - `dashboard/src/routes/prefetch.ts`: `"/flows": () => import("../pages/Flows"),` sau dòng `/org-chart`.
  - `src/octop/infra/users/preferences.py`: thêm `"flows",` sau `"org-chart",` trong `SIDEBAR_NAV_KEYS`.

- [x] **Step 5: Viết `scripts/add_flows_i18n.py`** theo mẫu `scripts/add_agencies_i18n.py`: nhận `--octop-dir <thư mục>` (bắt buộc; ghi `dashboard/src/locales/{en,zh}.json` trong thư mục đó) và luôn ghi `octop-orchester/src/dashboard/src/locales/vi.json`; chèn `nav.flows` ngay sau `nav.orgChart` và nhóm top-level `flows` ngay trước `"experts": {` đầu tiên của file; bỏ qua file đã có nhóm `flows`; bảo toàn CRLF (đọc/ghi bytes); `assert "{{" not in value`; đủ key theo bảng trên, nhãn nav: en "Flows", zh "流程", vi "Luồng tự động" (các copy khác tự viết cho 3 ngôn ngữ, giọng văn như nhóm `agencies`). Chạy: `python octop-orchester/scripts/add_flows_i18n.py --octop-dir "$WT"`.
  Expected: in `updated en`, `updated zh`, `updated vi`; chạy lần hai in `skip ...: already present` cho cả ba.

- [x] **Step 6: Sinh 7 patch từ worktree.** Với mỗi file đã sửa (5 file ở Step 4 + `en.json` + `zh.json`):
  `git -C "$WT" diff -- <đường dẫn trong worktree> > octop-orchester/patches/<đường dẫn>.workflow-ui.patch`
  Kiểm tra: mỗi patch đúng một header `diff --git`, hunk nhỏ (en/zh.json đúng 2 hunk), không có `--- /dev/null`.

- [x] **Step 7: Dọn worktree, rồi mở rộng công cụ.**
  `git -C octop worktree remove --force "$WT"` rồi `git -C octop status --short` phải rỗng.
  - `scripts/dashboard_test.sh`: nếu đối số đầu là `--tsc` thì cuối script chạy `exec npx tsc -b` thay vì vitest (bỏ đối số đó).
  - `scripts/vi-i18n/check_parity.py`: thêm `"flows."` vào `PATCH_ADDED_PREFIXES` và `"nav.flows"` vào `PATCH_ADDED_EXACT`.
  - `patches/manifest.yaml`: thêm tài liệu patch `workflow-ui` (target_repo octop, base_commit `890111b7`, `applies_to` đủ 7 file, `adds` liệt kê file overlay mới) theo mẫu của `org-chart`.

- [x] **Step 8: Chạy lại toàn bộ kiểm tra.**
  - `bash octop-orchester/scripts/dashboard_test.sh src/pages/Flows/navigation.test.ts src/layouts` → Expected: PASS (gồm `sidebarNav.test.ts` "covers every catalog key" và `sidebarNavLayout.test.ts`).
  - `python octop-orchester/scripts/vi-i18n/check_parity.py` → Expected: hai dòng `missing 0 | extra 0 | OK`.
  - `python octop-orchester/scripts/patch_status.py --apply-check` → Expected: `all patches apply cleanly`.
  - `bash octop-orchester/scripts/dashboard_test.sh --tsc` → Expected: exit 0. Nếu lỗi nằm ở file không thuộc plan này thì ghi nhận là lỗi nền, không sửa.

- [x] **Step 9: Đăng ký patch.** `python octop-orchester/scripts/patch_status.py --record` rồi `--report`; thêm dòng #4 "Flows" vào bảng §1 của `docs/00-PATCH-REGISTRY.md` (ngoài khối GENERATED), ghi thứ tự áp `agency` → `org-chart` → `workflow-ui`.

- [x] **Step 10: Dừng cho người dùng duyệt Task 2** (mở được `/flows` từ sidebar, trang rỗng có tiêu đề). Commit gợi ý khi được yêu cầu: `feat(flows): wire Flows route, sidebar item and i18n`.

---

### Task 3: Trang danh sách (C1)

**Files:**
- Create: `octop-orchester/src/dashboard/src/pages/Flows/lib/group-by-status.ts`, `…/lib/group-by-status.test.ts`, `…/components/FlowCard.tsx`, `…/components/FlowCard.test.tsx`, `…/index.module.less`, `…/index.test.tsx`
- Modify: `…/pages/Flows/index.tsx`

**Interfaces:**
- Consumes: Task 1 (`flowApi`, `FlowSummary`, `FlowDTO`, `FlowStatus`); bộ key `flows.*` của Task 2.
- Produces:
  ```ts
  // lib/group-by-status.ts — port nguyên từ orchester lib/flows/group-by-status.ts
  export function groupFlowsByStatus<T extends { status: FlowStatus }>(
    flows: readonly T[]): { status: FlowStatus; flows: T[] }[];   // active, paused, draft; bỏ nhóm rỗng
  // components/FlowCard.tsx
  export interface FlowCardProps { flow: FlowSummary; onOpen(id: string): void;
    onStatusChange(id: string, status: FlowStatus): void; onDeleted(id: string): void }
  export function FlowCard(props: FlowCardProps): JSX.Element;
  ```
  `index.tsx` giữ `export default function FlowsPage()`; Task 4 sẽ thêm `CreateFlowModal` vào cùng file.

- [x] **Step 1: Test `groupFlowsByStatus` (đỏ → xanh).** Copy bộ test của orchester (`group-by-status.test.ts`: thứ tự active/paused/draft giữ thứ tự đầu vào, `it.each` bỏ nhóm rỗng, rỗng → `[]`) với import `./group-by-status`. Chạy `bash octop-orchester/scripts/dashboard_test.sh src/pages/Flows/lib` → FAIL (thiếu module); cài hàm; chạy lại → PASS.

- [x] **Step 2: Test `FlowCard` (đỏ).** Mock `flowApi` (`vi.mock("../../../api/modules/flows")`) và `@/utils/antdModal` để `modal.confirm` gọi ngay `onOk`. Các test:
  - `"renders name, description, step count and a status tag"` → thấy tên, mô tả, `"3"` kèm `flows.stepCount`, và `flows.status.draft`.
  - `"opens the flow when the title is clicked"` → `onOpen` nhận đúng id.
  - `"changes status from the actions menu"` → mở menu (`aria-label` `flows.actions.more`), chọn `flows.actions.setActive` → `flowApi.update(id, { status: "active" })` và `onStatusChange(id, "active")`; lỗi `update` → `message.error` với `flows.statusFailed`, không gọi `onStatusChange`.
  - `"deletes after confirmation"` → chọn `flows.delete` → `flowApi.remove(id)` + `onDeleted(id)`; **Review Focus 4**: khi `modal.confirm` bị huỷ (không gọi `onOk`) thì `remove` không được gọi.

- [x] **Step 3: Cài `FlowCard.tsx` và `index.module.less`.** Bám `Agencies/components/AgencyCard.tsx`: thẻ click mở flow, tiêu đề là `<button>`, vùng hành động `stopPropagation`, `Tag` antd cho trạng thái, `Dropdown` antd (trigger là nút `MoreHorizontal` có `aria-label`) chứa 3 mục đổi trạng thái (ẩn mục trùng trạng thái hiện tại) + `Divider` + mục xoá `danger`; xoá dùng `modal.confirm` như AgencyCard. Meta: `{nodeCount} {t("flows.stepCount")} · {t("flows.updatedAt")} {Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" })}`. Less: sao các class `toolbar`, `toolbarSearch`, `searchEmpty`, `grid`, `gridMobile`, `card*`, `iconBtn*`, `loadingState`, `detail`, `backLink` từ `Agencies/index.module.less` (đổi màu cứng sang token đã dùng ở đó), thêm `groupHeader` (tiêu đề nhóm + số lượng).

- [x] **Step 4: Test trang (đỏ).** `index.test.tsx` mock `flowApi`, `useNavigate`, `useParams` (react-router), `useIsMobile`; bọc `MemoryRouter`. Test:
  - `"shows the empty state with a create action when there are no flows"` → `flows.empty`, `flows.emptyHint`, nút `flows.create`.
  - `"groups flows under status headings in active, paused, draft order"` → 3 flow đủ 3 trạng thái → thứ tự heading `flows.status.active`, `.paused`, `.draft`, mỗi heading kèm số lượng.
  - `"filters by search text"` → gõ vào ô `flows.searchPlaceholder` chỉ còn flow khớp tên; không khớp → `flows.empty` trong khối `searchEmpty`.
  - `"shows an error toast when loading fails"` → `list` reject → `message.error` với `flows.loadFailed`.
  - `"detail route shows the flow name, builderSoon and a back link"` → `useParams` trả `flowId`, `get` trả flow → thấy tên + `flows.builderSoon`; bấm `flows.back` → `navigate("/flows")`.
  - **Review Focus 3** `"detail route for an unknown id shows not-found, no crash"` → `get` reject → thấy `flows.notFound` + `flows.notFoundHint` và nút `flows.back`.
  - **Review Focus 4** `"removing the last flow returns to the empty state"` → render 1 flow, xoá qua card → xuất hiện `flows.empty`.

- [x] **Step 5: Cài `index.tsx`.** Một `FlowsPage` đọc `useParams<{ flowId?: string }>()`: có id → `FlowDetailView` (placeholder: nút quay lại, tên + mô tả + tag trạng thái, đoạn `flows.builderSoon`; `get` lỗi/không tìm thấy → `EmptyState` `flows.notFound`), không có → `FlowListView`. `FlowListView`: tải bằng `flowApi.list()` (lỗi → `message.error(t("flows.loadFailed"))`), thanh công cụ (ô tìm theo tên không phân biệt hoa thường + nút `flows.create` — Task 4 gắn hành động, ở Task này nút tồn tại nhưng chưa làm gì), `Spin` khi tải, `EmptyState variant="mascot"` (kèm `actionLabel`/`onAction` trống) khi không có flow, khối `searchEmpty` khi lọc không ra, ngược lại với mỗi nhóm của `groupFlowsByStatus` render `groupHeader` + lưới `FlowCard`; `onStatusChange` cập nhật phần tử trong state, `onDeleted` bỏ khỏi state, `onOpen` → `navigate(`/flows/${encodeURIComponent(id)}`)`; lưới thêm `gridMobile` khi `useIsMobile()`.

- [x] **Step 6: Chạy test.**
  Run: `bash octop-orchester/scripts/dashboard_test.sh src/pages/Flows`
  Expected: toàn bộ PASS; rồi `bash octop-orchester/scripts/dashboard_test.sh --tsc` → exit 0 (hoặc chỉ lỗi nền đã ghi ở Task 2).

- [x] **Step 7: Dừng cho người dùng duyệt Task 3.** Để người dùng xem tận mắt, gợi ý: `cd octop-orchester && docker compose up -d` rồi mở `/flows` (danh sách rỗng; sẽ có dữ liệu sau Task 4). Commit gợi ý khi được yêu cầu: `feat(flows): add flows list page`.

---

### Task 4: Thêm flow (C2)

**Files:**
- Create: `octop-orchester/src/dashboard/src/pages/Flows/lib/templates.ts`, `…/lib/templates.test.ts`, `…/components/CreateFlowModal.tsx`, `…/components/CreateFlowModal.test.tsx`
- Modify: `…/pages/Flows/index.tsx`, `…/pages/Flows/index.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`flowApi.create`, `FlowCreateInput`, `FlowDTO`, `StoredFlowNode`, `StoredFlowEdge`); khoá i18n `flows.templates.*`, `flows.createTitle`, … của Task 2; `FlowsPage`/`FlowListView` của Task 3.
- Produces:
  ```ts
  // lib/templates.ts
  import type { TFunction } from "i18next";
  export type FlowTemplateId = "blank" | "faq" | "alert";
  export interface BuiltFlowTemplate { name: string; description: string;
    nodes: StoredFlowNode[]; edges: StoredFlowEdge[] }
  export interface FlowTemplate { id: FlowTemplateId; build(t: TFunction): BuiltFlowTemplate }
  export const FLOW_TEMPLATES: readonly FlowTemplate[];   // thứ tự: blank, faq, alert
  // components/CreateFlowModal.tsx
  export interface CreateFlowModalProps { open: boolean; onClose(): void; onCreated(flow: FlowDTO): void }
  export function CreateFlowModal(props: CreateFlowModalProps): JSX.Element;
  ```

- [x] **Step 1: Test template (đỏ).** `templates.test.ts` với `t = (key: string) => key`:
  - `"offers blank, faq and alert in that order"` → `FLOW_TEMPLATES.map(x => x.id)`.
  - `"blank has no nodes or edges"` → `build(t)` có `nodes: []`, `edges: []`, `name === "flows.templates.blank.name"`.
  - `"faq is trigger(message) -> agent"` → 2 node: `{ id: "t", type: "trigger", config: { triggerKind: "message" }, label: "flows.templates.faq.nodes.trigger" }` và `{ id: "a", type: "agent", label: "flows.templates.faq.nodes.agent" }`; edge `{ id: "t-a", source: "t", target: "a" }`.
  - `"alert is trigger(message) -> notify"` → node 2 có `type: "notify"`; edge `t-n`.
  - `"every edge endpoint exists and node ids are unique"` cho cả ba template.
  Chạy `bash octop-orchester/scripts/dashboard_test.sh src/pages/Flows/lib/templates.test.ts` → FAIL.

- [x] **Step 2: Cài `templates.ts`.** Node dạng stored, vị trí `x: 0` và `x: 280`, `y: 0`; `config` của `agent` là `{ prompt: "" }`, của `notify` là `{ to: "", message: "" }`; `name`/`description`/`label` lấy từ `t(...)` theo key trong bảng i18n Task 2. Chạy lại → PASS.

- [x] **Step 3: Test modal (đỏ).** Mock `flowApi`; render `CreateFlowModal open`. Test:
  - `"lists the three templates with blank selected"` → ba lựa chọn theo thứ tự blank/faq/alert, blank được chọn.
  - `"prefills the name from the chosen template"` → chọn faq → ô tên bằng `flows.templates.faq.name`.
  - `"creates a flow from the chosen template"` → chọn alert, sửa tên thành `"  Báo tin  "`, nhập mô tả, bấm `flows.save` → `flowApi.create` được gọi với `name: "Báo tin"`, `description` đúng, `nodes`/`edges` của template alert; sau đó `onCreated(flow)` được gọi với flow trả về.
  - **Review Focus 5** `"blocks a blank or whitespace-only name"` → xoá tên / gõ toàn dấu cách → bấm lưu → `flowApi.create` không được gọi, ô tên hiện lỗi; `"blocks names over 64 characters"` → gõ 65 ký tự (input có `maxLength={64}` nên dùng `fireEvent.change` ép giá trị) → không gọi `create`.
  - `"keeps the modal open and toasts on failure"` → `create` reject → `message.error` với `flows.saveFailed`, `onCreated` không được gọi, `onClose` không được gọi.
  - `"resets to blank when reopened"` → mở, chọn faq, đóng, mở lại → blank được chọn, tên trống/được prefill theo blank.

- [x] **Step 4: Cài `CreateFlowModal.tsx`.** Bám `AgencyFormModal.tsx` (antd `Modal` + `Form` vertical, `destroyOnHidden`, `confirmLoading`, `maskClosable={!saving}`): `Form.Item name="template"` dùng `Radio.Group` kiểu thẻ (tên + mô tả của từng template) ; khi đổi template (`onValuesChange`) gán `name` = tên template; `name` rule `{ required: true, whitespace: true, max: 64 }`; `description` `Input.TextArea` `maxLength={500}`; `submit` validate → `flowApi.create({ ...template.build(t), name: values.name.trim(), description: values.description?.trim() || null })`; thành công → `onCreated`; lỗi → `message.error(t("flows.saveFailed"))`. Chạy test modal → PASS.

- [x] **Step 5: Nối vào trang.** Trong `index.tsx`: state `createOpen`; nút `flows.create` (thanh công cụ) và `onAction` của empty state đều mở modal; `onCreated(flow)` → `message.success(t("flows.created"))`, đóng modal và `navigate(`/flows/${encodeURIComponent(flow.id)}`)` (mở placeholder detail). Thêm vào `index.test.tsx`: `"opens the create modal from the toolbar and the empty state"` và `"navigates to the new flow after creation"` (mock `CreateFlowModal` để gọi ngay `onCreated`, kiểm `navigate` được gọi với `/flows/<id>`).

- [x] **Step 6: Kiểm tra toàn bộ.**
  - `bash octop-orchester/scripts/dashboard_test.sh` (toàn bộ vitest của dashboard) → Expected: không có test nào đỏ do thay đổi này.
  - `bash octop-orchester/scripts/dashboard_test.sh --tsc` → exit 0 (hoặc chỉ lỗi nền đã ghi).
  - `python octop-orchester/scripts/patch_status.py --apply-check` → sạch; `python octop-orchester/scripts/vi-i18n/check_parity.py` → OK.
  - Build thật: `cd octop-orchester && docker compose build --progress=plain 2>&1 | grep -E "applying|FAILED:"` → Expected: 49 dòng `applying` (42 cũ + 7 mới), không `FAILED`.

- [x] **Step 7: Dừng cho người dùng duyệt Task 4.** Hướng dẫn xem thật: `docker compose up -d`, mở dashboard → sidebar **Flows** → **Add flow** → chọn template → tạo → thấy placeholder, quay lại thấy thẻ trong nhóm Draft; đổi trạng thái/xoá thử trên thẻ; tải lại trang vẫn còn dữ liệu (localStorage). Commit gợi ý khi được yêu cầu: `feat(flows): add create-flow modal with templates`.

---

## Self-Review (đã chạy)

- **Spec coverage:** C0 (Task 2 + data layer Task 1), C1 L3–L5, L8 (Task 3), C2 L6–L7 (Task 4). L1 rút gọn (tiêu đề + mô tả) nằm trong `PageShell`. Registry 8 node cố ý dời — đã ghi ở "Phạm vi" và cập nhật spec. B-series (builder) ngoài phạm vi.
- **Placeholder scan:** không có "TBD"; các copy i18n do người cài viết theo giọng nhóm `agencies` (bảng key đã đủ tên).
- **Type consistency:** `FlowStatus`/`FlowSummary`/`FlowDTO` định nghĩa một lần ở Task 1; `FlowCardProps.onStatusChange(id, status)` và `CreateFlowModalProps.onCreated(flow: FlowDTO)` dùng đúng tên ở Task 3–4.
- **Proportion:** plan chủ yếu là chữ ký, tên test + assertion, lệnh; không chứa thân hàm.

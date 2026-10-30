# Kiến trúc — Sơ đồ tổ chức (Org Chart)

| Dự án | Octop-Orchester |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-10-30 |
| Base | `octop/` @ `890111b7` (v0.9.16-824-g890111b7, tag v1.0.3b1) |
| Tham chiếu | [01-AGENCY-ARCHITECTURE.md](01-AGENCY-ARCHITECTURE.md), [README §4.12](../README.md) |

## 1. Mục đích

Trang `/org-chart` vẽ toàn bộ tổ chức thành canvas tương tác: **Tổ chức → Phòng ban → Expert**, kèm edge **team host → member** và badge kênh trên card agent.

Mục tiêu là một cái nhìn duy nhất trả lời "ai thuộc bộ phận nào, team nào gọi team nào, expert nào đang chạy" — thay vì mở từng trang Experts/Teams.

Đọc-only về dữ liệu: kéo node chỉ đổi vị trí hiển thị, không đổi cấu trúc. Muốn gán/gỡ expert khỏi phòng ban thì qua trang Phòng ban.

Phụ thuộc: patch `agency` phải có trước (bảng `agency` + `agency_member`).

### Vị trí trên UI

| Chỗ xuất hiện | Đường dẫn | Component |
|---|---|---|
| Sidebar cấp 1 — mục **Sơ đồ tổ chức** (icon `Network`, ngay dưới Phòng ban) | `/org-chart` | `pages/OrgChart/index.tsx` |
| Click node phòng ban | → `/agencies/:id` (hoặc `/agencies` nếu `agency:__unassigned__`) | `onNodeClick` split tiền tố |
| Click node expert | → `/experts?agent=<id>` (mở drawer sửa) | patch `pages/Experts/index.tsx` đọc `?agent=` |

Nhãn sidebar: `nav.orgChart` = "Sơ đồ tổ chức" (vi) / "Org chart" (en) / "组织架构图" (zh). Cùng gate `if (user)` như Agencies — đây là view chỉ-đọc của cùng dữ liệu.

## 2. Kiến trúc

Một endpoint, một round trip:

```
Browser /org-chart
  │  GET /api/org-graph          (một request duy nhất)
  ▼
routers/orgchart.py
  ├─ registry.list_agents(user.id)                  ─┐ đúng hai lời gọi
  ├─ agent_repo.list_shared(...)                     ─┘ của GET /api/agents?scope=mine
  ├─ SELECT agency, agency_member                    (overlay 001)
  ├─ SELECT channels WHERE agent_id IN (visible)     (badge kênh)
  └─ teams.visible_member_ids(host_id)               (roster nằm ở .octop/manifest.json)
  ▼
{nodes, edges, summary}
  │
Client
  ├─ layout.ts   layoutNodes()  — xếp hàng thuần, không DOM  (có test)
  ├─ trộn vị trí đã kéo từ localStorage
  └─ ReactFlow render + poll 15s
```

Quyết định kiến trúc đáng ghi nhớ:

1. **Một endpoint**, không phải ba call `/org-graph`, `/agencies`, `/agents`. Frontend không phải lắp ráp hay đồng bộ ba nguồn.
2. **Không viết lại rule phân quyền.** Tập agent hiển thị = đúng hai lời gọi `GET /api/agents?scope=mine` dùng. Sửa rule ở upstream thì sơ đồ theo luôn.
3. **Edge team không dựng bằng SQL được.** Team host là agent `kind='team'`, roster nằm trong `.octop/manifest.json` chứ không phải bảng nối → phải gọi `TeamService.visible_member_ids()`.
4. **Edge chỉ vẽ khi cả hai đầu nằm trong tập hiển thị.** Member được chia sẻ ngoài quyền người xem bị loại, không lộ tên qua edge treo.
5. **Node id có tiền tố** (`root:`, `agency:`, `agent:`) để frontend route click bằng cách split, không cần tra thêm.
6. **Mỗi agent vẽ một lần.** `agency_member` là N-N nhưng node trùng id sẽ làm ReactFlow vỡ — agency đứng trước theo tên giữ agent.
7. **Layout là hàm thuần** trong file riêng, test được không cần DOM và không import `@xyflow/react`.
8. **`@xyflow/react` cùng thư viện Orchester dùng**, không tự viết canvas.

### Ánh xạ Orchester → Octop

| Orchester | Octop | Nguồn |
|---|---|---|
| workspace | node gốc "Tổ chức" | tổng hợp |
| team | agency | `agency` + `agency_member` |
| `team-agent` edge | `agency-agent` edge | `agency_member` |
| `flow-agent` / `agent-agent` edge | `team-agent` edge (host → member) | `TeamService.visible_member_ids()` |
| `team:__orphan__` | `agency:__unassigned__` | agent không có trong `agency_member` |
| live flow (animated) | host/member đang chạy | `agents.last_state == 'running'` |
| `role` trên agent | `description` (Octop không có role) | `agents.description` |

## 3. Cấu trúc folder

```
octop-orchester/
├── patches/                                            SỬA file upstream (11 patch)
│   ├── dashboard-pkg/dashboard/package.json.org-chart.patch        ← áp TRƯỚC npm ci
│   ├── dashboard-pkg/dashboard/package-lock.json.org-chart.patch   ← áp TRƯỚC npm ci
│   ├── dashboard/src/layouts/sidebarNav.tsx.org-chart.patch
│   ├── dashboard/src/layouts/sidebarNavLayout.test.ts.org-chart.patch
│   ├── dashboard/src/routes/index.tsx.org-chart.patch
│   ├── dashboard/src/routes/prefetch.ts.org-chart.patch
│   ├── dashboard/src/pages/Experts/index.tsx.org-chart.patch        ← deep-link ?agent=
│   ├── dashboard/src/locales/en.json.org-chart.patch
│   ├── dashboard/src/locales/zh.json.org-chart.patch
│   ├── src/octop/api/app.py.org-chart.patch
│   └── src/octop/infra/users/preferences.py.org-chart.patch
├── src/
│   ├── dashboard/src/api/modules/orgChart.ts            type + getOrgGraph()
│   ├── dashboard/src/pages/OrgChart/
│   │   ├── index.tsx                                    trang: canvas, search, reset, poll, click
│   │   ├── index.module.less                            style node + khung canvas
│   │   ├── layout.ts                                    layoutNodes() — hàm thuần
│   │   ├── layout.test.ts                               test layout, không cần DOM
│   │   └── components/nodes.tsx                         RootNode / AgencyNode / AgentNode
│   ├── dashboard/src/locales/vi.json                    sửa trực tiếp: nav.orgChart + org.*
│   └── src/octop/api/routers/orgchart.py                GET /org-graph
├── scripts/
│   ├── orgchart_route_selfcheck.py                      AST: đúng 1 route, không path-param ở gốc /api
│   └── orgchart_api_smoke.py                            smoke HTTP end-to-end trên container
└── Dockerfile                                           sửa: áp patches/dashboard-pkg trước npm ci
```

Số dòng: router 263, trang 275, layout 139 (+ test 148), nodes 125, less 206.

### Thứ tự build — thay đổi bắt buộc ở Dockerfile

`@xyflow/react` là dependency mới, phải có trong `package.json` **trước** `npm ci`; `npm ci` từ chối lock không khớp `package.json`. Dockerfile tách `patches/dashboard-pkg/` áp ngay sau `COPY package.json package-lock.json`, trước `npm ci`; `patches/dashboard/` vẫn áp sau khi copy source. Cả hai `git apply` từ `/build` (không phải `/build/dashboard`) vì đường dẫn patch relative với gốc `octop/`.

`package-lock.json` sinh bằng `npm install --save @xyflow/react@12.12.0 --package-lock-only`, không viết tay.

## 4. API

`GET /api/org-graph`, mount trong `app.py`: `_RouterMount(orgchart.router, "/api", ["org-chart"])`.

Auth: chỉ `Depends(current_user)`. Không permission key.

```ts
OrgNode  = { id: string; type: "root" | "agency" | "agent"; label: string; meta: … }
OrgEdge  = { id: string; source: string; target: string;
             kind: "root-agency" | "agency-agent" | "team-agent";
             animated?: boolean; label?: string }
OrgGraph = { nodes: OrgNode[]; edges: OrgEdge[];
             summary: { agencies; agents; activeAgents; teams; channels } }
```

`id` tiền tố: `root:org`, `agency:<agency_id>`, `agent:<agent_id>`, và node tổng hợp `agency:__unassigned__`.

`meta`:

| Node | meta |
|---|---|
| root | `{ agencyCount, agentCount, teamCount, channelCount }` |
| agency | `{ color, iconName, agentCount, activeCount, description, unassigned?: true }` |
| agent | `{ agentId, description, model, state, color, iconName, kind, channelCount, channels: [{channelId,name,kind}], teamMember }` |

### Hàm nội bộ (`routers/orgchart.py`)

| Hàm | Việc |
|---|---|
| `_visible_rows(server, user)` | gộp `list_agents(user.id)` + `list_shared(...)`, khử trùng theo `agent_id` |
| `_team_members(server, host_id)` | bọc `teams.visible_member_ids`; roster hỏng → `[]`, không làm hỏng sơ đồ |
| `_channels_by_agent(conn, ids)` | một câu `IN (...)` → dict theo agent |
| `_agency_rows(conn)` / `_membership(conn)` | hai câu đọc overlay |
| `_agent_node_id` / `_agency_node_id` | ghép tiền tố id |

Luật dựng node:

- Agency **0 agent hiển thị** → không vẽ (kể cả edge root→agency).
- Agent không thuộc agency nào → gom node "Chưa phân ban", luôn ở hàng cuối.
- Agent thuộc nhiều agency → chỉ vẽ dưới agency đầu tiên theo tên.
- `summary.agencies` = số agency thực sự vẽ, không phải số row trong bảng.

### Frontend

| Thành phần | Việc |
|---|---|
| `layoutNodes(nodes, edges)` | `buildGroups` (agency + member, bỏ agency rỗng) → `packRows` (hàng ≤ `MAX_ROW_WIDTH` 2400px) → toạ độ; root căn giữa toàn bộ hàng |
| `RootNode` / `AgencyNode` / `AgentNode` | memo, CSS module (Octop dashboard không dùng Tailwind) |
| `filterWithAncestors` | search giữ node khớp **và toàn bộ tổ tiên** (root, agency chứa nó) |
| `readPositions` / `writePositions` | `localStorage["octop:org:positions"]`, bọc `try/catch` — private window vẫn render |
| `persist` | debounce 250ms sau `onNodeDragStop` |
| `resetLayout` | xóa key + dựng lại layout mặc định |
| `onNodeClick` | split tiền tố: agency → `/agencies/:id` (hoặc `/agencies` nếu `__unassigned__`), agent → `/experts?agent=<id>` |

Hằng layout: `COL_WIDTH_AGENT=240`, `COL_GAP_AGENCY=36`, `ROW_ROOT_Y=0`, `ROW_AGENCY_Y=150`, `ROW_AGENT_Y=300`, `ROW_BAND_HEIGHT=540`, `AGENCY_NODE_W=220`, `ROOT_NODE_W=240`, `AGENT_NODE_W=200`.

Deep-link: `Experts/index.tsx` patch thêm `useEffect` đọc `?agent=` → tìm trong `localAgents` → `setEditAgent(row)`. Chỉ 8 dòng, không đụng logic trang.

## 5. Schema

**Không có bảng mới.** Org chart chỉ đọc:

| Bảng | Cột dùng | Ai tạo |
|---|---|---|
| `agency`, `agency_member` | `agency_id, name, description, color, icon_name` / cặp (agency_id, agent_id) | overlay migration 001 (patch `agency`) |
| `agents` | `agent_id, name, description, default_model, last_state, color, icon_name, kind, user_id` | upstream |
| `channels` | `channel_id, agent_id, name, kind` | upstream |
| `users` | qua `current_user` | upstream |
| `.octop/manifest.json` | roster team host → member | upstream, qua `TeamService` |

Mapper trả về là row của registry/agent_repo (không phải dict SQL thô), nên field đọc bằng `getattr(row, …)` với default — an toàn nếu upstream đổi shape nhẹ.

## 6. Migration

Không có migration mới trong patch này. Bảng phụ thuộc do overlay migration `001_agency` (patch `agency`) tạo, chạy qua `run_overlay_migrations(db)` tại hai điểm boot trong `server.py`.

Hệ quả cần nhớ: **patch `org-chart` một mình không chạy được** — `SELECT … FROM agency` sẽ lỗi nếu 001 chưa áp. Manifest đánh dấu `adds`/`applies_to` đầy đủ để rebase không bỏ sót.

## 7. Patch và file — danh sách đầy đủ

`patches/manifest.yaml` document `id: org-chart`, `base_commit: 890111b7`.

| Patch | Anchor | Thay đổi |
|---|---|---|
| `dashboard/package.json` | khối `dependencies` | `"@xyflow/react": "^12.12.0"` |
| `dashboard/package-lock.json` | — | lock sinh bằng npm, không viết tay |
| `dashboard/src/layouts/sidebarNav.tsx` | import `Building2`; `SIDEBAR_NAV_KEYS`; block agencies | `Network`; key `"org-chart"`; push item `/org-chart` sau agencies, gate `if (user)` |
| `…/sidebarNavLayout.test.ts` | mảng `ungrouped` | `"org-chart"` sau `"agencies"` |
| `dashboard/src/routes/index.tsx` | `AgenciesPage` lazy; `pathToKey`; route `/agencies` | `OrgChartPage` lazy + `{ path: "/org-chart" }` + `pathToKey` |
| `dashboard/src/routes/prefetch.ts` | `"/agencies": …` | `"/org-chart": () => import("../pages/OrgChart")` |
| `dashboard/src/pages/Experts/index.tsx` | `const handleEditSaved = useCallback(` | `useEffect` đọc `?agent=` → `setEditAgent` (~8 dòng) |
| `dashboard/src/locales/en.json`, `zh.json` | sau `nav.agencies`; sau `"agencies": {` | `nav.orgChart` + nhóm `org.*` (23 leaf key) |
| `src/octop/api/app.py` | import routers; `_RouterMount` | `orgchart` + `_RouterMount(orgchart.router, "/api", ["org-chart"])` |
| `src/octop/infra/users/preferences.py` | frozenset `SIDEBAR_NAV_KEYS` | `"org-chart"` sau `"agencies"` |

Khoá i18n mới:

```
nav.orgChart
org.title .subtitle .searchPlaceholder .resetLayout .resetLayoutTitle
    .empty .emptyHint .createFirstAgency .loadFailed
org.summary.{agencies,agents,agentsActive,teams,channels}
org.node.{organization,agency,agent,unassigned,team,teamHost,channels,noModel}
```

`en.json`/`zh.json` qua patch; `vi.json` sửa trực tiếp. `check_parity.py` thêm `org.` vào `PATCH_ADDED_PREFIXES` và `nav.orgChart` vào `PATCH_ADDED_EXACT` để không báo extra.

**Kiểm lỗi thời.** `patches/lock.json` giữ sha256 upstream của 11 file tại `890111b7`; `scripts/patch_status.py` báo `STALE org-chart` khi có file đã đổi. Danh sách đầy đủ: [00-PATCH-REGISTRY §4](00-PATCH-REGISTRY.md).

Hai chỗ dễ vỡ nhất khi rebase:

- **`dashboard/package-lock.json`** — patch sinh bằng npm, 5 hunk, +79/−2. Upstream nâng dependency khác là lock đổi ở mọi nơi và patch này hỏng ngay. Cách sửa: áp `package.json` trước, rồi `npm install --package-lock-only` trên cây mới để sinh lại lock, rồi `git diff > .../package-lock.json.org-chart.patch`. **Không** viết tay.
- **`dashboard/src/routes/index.tsx`, `sidebarNav.tsx`** — anchor là code do patch `agency` chèn vào, nên rebase **phải theo thứ tự** `agency` → `org-chart`. Nếu rebase ngược thứ tự, anchor không tồn tại và cả hai patch đều báo lỗi.

## 8. Kiểm thử

| Mức | Lệnh | Kỳ vọng |
|---|---|---|
| Unit layout | `npm run test` trong `dashboard/` | `layout.test.ts`: pack nhiều hàng; agency rộng hơn `MAX_ROW_WIDTH` chiếm hàng riêng; agent chưa phân ban ở hàng cuối; hàng không chồng nhau |
| Route self-check | `python octop-orchester/scripts/orgchart_route_selfcheck.py` | đúng 1 route `/org-graph`, không route path-param ở gốc `/api` |
| Smoke API | `python octop-orchester/scripts/orgchart_api_smoke.py` | tạo agency + gán agent → node + edge `agency-agent`; tạo team + channel → edge `team-agent` + badge; xóa → mất; tự dọn |
| Build | `docker compose build --no-cache 2>&1 \| grep -E "applying\|FAILED:"` | 11 dòng `org-chart`, 0 `FAILED` |
| Lockfile | `npm ci` trong image | pass (bước này chính là test lock) |
| i18n | `python octop-orchester/scripts/vi-i18n/check_parity.py` | `missing 0 \| extra 0` |
| UI | mở `/org-chart` | cây đúng → kéo node → reload giữ vị trí → search lọc + tổ tiên → click agent mở drawer, click agency sang trang phòng ban |

`layout.test.ts` không import `@xyflow/react` — đó là lý do layout tách ra file riêng thay vì nằm trong `index.tsx`.

## 9. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| `package-lock.json` lệch khi nâng base | Patch lock chỉ thêm block `@xyflow/react`; lệch thì xoá patch và regenerate bằng npm |
| Patch `Experts/index.tsx` (hàng nghìn dòng) lệch | Patch chỉ 1 import + 1 `useEffect` ~8 dòng |
| `sidebarNavLayout.test.ts` khẳng định cứng `ungrouped` | Thêm `"org-chart"` vào kỳ vọng — cùng cách patch `agency` làm |
| Bundle lớn thêm ~150KB | Trang lazy-load riêng, không vào chunk khởi động |
| Vị trí `localStorage` lệch khi số node đổi nhiều | Nút "Xếp lại" xóa key và dựng lại |
| Roster team hỏng / manifest lỗi | `_team_members` bọc `try/except` → `[]`; sơ đồ vẫn vẽ phần còn lại |
| `localStorage` bị chặn (private window) | `try/catch` cả đọc và ghi; dùng layout mặc định |

## 10. Tiêu chí hoàn thành

1. Build sạch, `npm ci` pass với dependency mới, 0 `FAILED`.
2. `/org-chart` hiện đúng cây Tổ chức → Phòng ban → Expert.
3. Agent chưa vào phòng ban nằm trong nhóm "Chưa phân ban".
4. Edge team host → member hiện, có nhãn tên team, animated khi một đầu đang chạy.
5. Badge kênh đúng số trên card agent.
6. Kéo node → reload → vị trí giữ nguyên; "Xếp lại" trả về mặc định.
7. Click agent mở drawer (`?agent=`), click agency sang `/agencies/:id`.
8. `git -C octop status --short` rỗng.
9. `check_parity.py` → `missing 0 | extra 0`.

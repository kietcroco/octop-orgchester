# Kiến trúc — Phòng ban (Agency)

| Dự án | Octop-Orchester |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-10-30 |
| Base | `octop/` @ `890111b7` (v0.9.16-824-g890111b7, tag v1.0.3b1) |
| Tham chiếu | [README §4.9](../README.md), [00-PATCH-REGISTRY](00-PATCH-REGISTRY.md) |

## 1. Mục đích

Thêm **Phòng ban (Agency)** như một thực thể thứ ba, độc lập với hai khái niệm sẵn có của Octop:

| Khái niệm Octop | Là gì | Có dùng lại? |
|---|---|---|
| `agents.kind = "team"` | expert team, roster trong `.octop/manifest.json` | Không |
| `user_group` | nhóm để phân quyền | Không |
| **`agency` (overlay)** | danh mục phòng ban, gom agent để hiển thị/tổ chức | Mới |

Chức năng: CRUD phòng ban; gán/gỡ expert vào phòng ban từ hai màn hình; xem danh sách expert + kênh (channel) mà phòng ban đang chạm tới; hiển thị dữ liệu này trên sơ đồ tổ chức ([02-ORGCHART-ARCHITECTURE.md](02-ORGCHART-ARCHITECTURE.md)).

**Không** phải ACL: phòng ban không quyết định ai thấy agent nào. **Không** sở hữu kênh: kênh thuộc agent, phòng ban chỉ suy ra qua membership.

### Vị trí trên UI

| Chỗ xuất hiện | Đường dẫn | Component |
|---|---|---|
| Sidebar cấp 1 — mục **Phòng ban** (icon `Building2`, ngay trên Experts) | `/agencies` | `pages/Agencies/index.tsx` |
| Chi tiết một phòng ban | `/agencies/:agencyId` | cùng file, đọc `useParams` |
| Drawer sửa expert — khối chọn phòng ban | `/experts` → sửa expert | `components/AgentAgencyPicker.tsx` |
| Click card phòng ban trên sơ đồ tổ chức | `/org-chart` → `/agencies/:id` | xem [02-ORGCHART](02-ORGCHART-ARCHITECTURE.md) |

Nhãn sidebar: `nav.agencies` = "Phòng ban" (vi) / "Agencies" (en) / "部门" (zh). Không có permission key — mọi user đã đăng nhập đều thấy và quản lý được.

## 2. Kiến trúc

Bốn tầng, toàn bộ nằm ngoài upstream:

```
Browser
  └─ React (dashboard)  pages/Agencies, api/modules/agency.ts, AgentAgencyPicker
        │  request() → JWT
        ▼
FastAPI  /api/agencies/*   routers/agencies.py        ← file mới, overlay
        │  server.services.repos.db (SQL trực tiếp, không repo class)
        ▼
SQLite/Postgres   agency, agency_member                ← overlay migration 001
        │
        ▼
Upstream tables   agents, channels, users              ← chỉ đọc / FK
```

Quyết định kiến trúc đáng ghi nhớ:

1. **Thực thể độc lập**, không reskin team hay user_group — hai khái niệm kia có ngữ nghĩa riêng (roster, permission).
2. **N-N qua bảng nối** `agency_member`, không nhét cột `agency_id` vào `agents` (một agent thuộc nhiều phòng ban).
3. **Không repo class.** 8 endpoint dùng ~10 câu SQL, mỗi câu một hai call site — thêm `AgencyRepo` lúc này là abstraction rỗng. Đánh dấu trong module: `# ponytail: no AgencyRepo`.
4. **Không permission key.** Cả 8 endpoint chỉ `Depends(current_user)`, nên route `/agencies` không bị `RequirePermission` bọc và `tests/unit/api/test_acl_gate_coverage.py` không phải sửa.
5. **Ledger migration riêng** — xem §6.
6. **Gán là thay thế toàn bộ (PUT)**, không POST/DELETE từng phần tử: một request, không trạng thái nửa vời, hai màn hình cùng thao tác trên một tập.
7. **ID lạ bị bỏ qua, không 400.** Agent có thể vừa bị xóa ở tab khác; PUT 5 agent không nên hỏng vì 1 agent biến mất.

## 3. Cấu trúc folder

```
octop-orchester/
├── patches/                                        SỬA file upstream (10 patch)
│   ├── dashboard/src/layouts/sidebarNav.tsx.agency.patch
│   ├── dashboard/src/layouts/sidebarNavLayout.test.ts.agency.patch
│   ├── dashboard/src/locales/en.json.agency.patch
│   ├── dashboard/src/locales/zh.json.agency.patch
│   ├── dashboard/src/pages/Experts/components/EditAgentDrawer.tsx.agency.patch
│   ├── dashboard/src/routes/index.tsx.agency.patch
│   ├── dashboard/src/routes/prefetch.ts.agency.patch
│   ├── src/octop/api/app.py.agency.patch
│   ├── src/octop/infra/server.py.agency.patch
│   └── src/octop/infra/users/preferences.py.agency.patch
├── src/                                            THÊM file mới (đường dẫn y hệt octop/)
│   ├── dashboard/src/api/modules/agency.ts          client + type
│   ├── dashboard/src/api/modules/agency.test.ts     unit test client
│   ├── dashboard/src/pages/Agencies/
│   │   ├── index.tsx                                list + detail (một component, đọc :agencyId)
│   │   ├── index.module.less
│   │   └── components/
│   │       ├── AgencyCard.tsx                       card grid: màu, tên, số agent/kênh, sửa/xóa
│   │       ├── AgencyFormModal.tsx                  modal tạo/sửa, dùng ExpertColorPicker
│   │       ├── AgencyAgentList.tsx                  cột trái: agent trong phòng ban
│   │       ├── AgencyChannelList.tsx                cột phải: kênh suy ra, read-only
│   │       └── AgentAgencyPicker.tsx                picker gắn vào drawer sửa agent
│   ├── dashboard/src/locales/vi.json                sửa trực tiếp: nav.agencies + agencies.*
│   └── src/octop/
│       ├── api/routers/agencies.py                  8 endpoint
│       └── overlay/
│           ├── __init__.py                          export run_overlay_migrations
│           ├── migrate.py                           runner + ledger
│           └── migrations/
│               ├── 001_agency.sql                   SQLite
│               └── 001_agency.pg.sql                PostgreSQL
└── scripts/
    ├── overlay_selfcheck.py                         migration idempotent + cascade
    ├── agencies_route_selfcheck.py                  thứ tự khai báo route (AST)
    ├── agencies_api_smoke.py                        smoke 8 endpoint trên container
    └── add_agencies_i18n.py                         chèn khoá i18n (idempotent)
```

Số dòng thực tế: router 373, migrate 119, trang list/detail 264, less 455, 5 component 510, client 109.

## 4. API

Router: `src/octop/api/routers/agencies.py`, mount trong `app.py`:

```python
_RouterMount(agencies.router, "/api/agencies", ["agencies"])
```

| Method | Path | Body | Trả về |
|---|---|---|---|
| GET | `/api/agencies` | — | `AgencySummary[]`, sort theo `name` |
| POST | `/api/agencies` | `{name, description?, color?, icon_name?}` | `AgencyDetail`, 201 |
| GET | `/api/agencies/by-agent/{agent_id}` | — | `{agency_ids: string[]}` |
| PUT | `/api/agencies/by-agent/{agent_id}` | `{agency_ids: string[]}` | `{agency_ids: string[]}` |
| GET | `/api/agencies/{agency_id}` | — | `AgencyDetail` |
| PATCH | `/api/agencies/{agency_id}` | `{name?, description?, color?, icon_name?}` | `AgencyDetail` |
| DELETE | `/api/agencies/{agency_id}` | — | 204 |
| PUT | `/api/agencies/{agency_id}/members` | `{agent_ids: string[]}` | `AgencyDetail` |

**Thứ tự khai báo bắt buộc**: hai route `by-agent/*` phải đứng **trước** `/{agency_id}`, nếu không FastAPI khớp `by-agent` thành `agency_id`. Có self-check AST khẳng định đúng thứ tự.

Auth: mọi endpoint `Depends(current_user)`. Không `require_permission`.

Lỗi:

| Tình huống | Mã |
|---|---|
| Tên rỗng / > 64 ký tự | `OctopError(FORBIDDEN, status=400)` |
| Trùng tên (create + patch) | `409 agency name is already in use` |
| `agency_id` không tồn tại | `OctopError(NOT_FOUND)` |
| `agent_ids` / `agency_ids` chứa ID lạ | bỏ qua, không lỗi |
| Agent lạ trong PUT by-agent | trả `[]`, không chạm DB |

PATCH phân biệt "không gửi field" với "gửi null" bằng `body.model_fields_set`, nên xóa được `description`/`icon_name` về NULL.

### Hàm nội bộ

| Hàm | Việc |
|---|---|
| `_clean_name(raw)` | strip + validate độ dài, trả 400 thay vì 422 của Pydantic |
| `_clean_optional(raw)` | strip, chuỗi rỗng → `None` |
| `_summary(row)` | row → `AgencySummary` |
| `_detail(conn, agency_id)` | summary + `agents[]` + `channels[]` trong một lần mở conn |
| `_fetch_summary(conn, agency_id)` | tồn tại? không → 404 |
| `_known_agent_ids` / `_known_agency_ids` | lọc ID tồn tại, giữ thứ tự, khử trùng |

`_SUMMARY_SQL` có hai subquery tương quan: `agent_count`, `channel_count` (`COUNT(DISTINCT c.channel_id)` qua join `agency_member → channels`).

### Frontend

`agency.ts` bọc `request()` (tự gắn JWT, xử lý 401/403 tập trung) — không tự fetch.

| Component / hàm | Việc |
|---|---|
| `AgenciesPage` | đọc `:agencyId` từ URL: có → detail, không → list |
| `AgencyListView` | search client-side theo tên, card grid, modal create |
| `AgencyDetailView` | header (màu, tên, mô tả, 2 số đếm) + 2 cột agent/kênh |
| `AgencyAgentList` | chọn từ danh sách agent user thấy (loại `kind === "team"`), PUT members |
| `AgencyChannelList` | read-only, kênh suy ra |
| `AgentAgencyPicker` | antd `Select mode="multiple"`, optimistic update + rollback khi lỗi |
| `AgencyCard` / `agencySwatchColor` | card + resolve màu palette/hex |
| `AgencyFormModal` | create/edit dùng chung, nút submit disable khi đang gửi |

`agencySwatchColor` nhận cả key palette (`blue`, `violet`…) lẫn hex — dữ liệu cũ từ `ExpertColorPicker` là key.

## 5. Schema

`001_agency.sql` (SQLite) — bản `.pg.sql` đổi `INTEGER PRIMARY KEY AUTOINCREMENT` → `BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`, timestamp `INTEGER` → `BIGINT`:

```sql
CREATE TABLE IF NOT EXISTS agency (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id   TEXT NOT NULL UNIQUE,        -- id công khai, new_short_id()
  name        TEXT NOT NULL UNIQUE,        -- trùng tên → 409
  description TEXT,
  color       TEXT NOT NULL DEFAULT 'blue',
  icon_name   TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agency_member (
  agency_id  TEXT NOT NULL REFERENCES agency(agency_id) ON DELETE CASCADE,
  agent_id   TEXT NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (agency_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_member_agent ON agency_member(agent_id);
```

Khuôn bám migration `023_user_group` của upstream: PK số nội bộ + `*_id TEXT UNIQUE` công khai, bảng nối có `created_at`, index theo chiều ngược.

`ON DELETE CASCADE` hai chiều: xóa phòng ban tự cắt liên kết; xóa agent tự rời mọi phòng ban — không cần code dọn dẹp.

**Không có bảng kênh.** Kênh suy ra qua `agency_member → channels.agent_id`, đúng như Orchester (`channel.teamId` chỉ là FK một chiều).

## 6. Migration — folder và ledger riêng

| Thành phần | Vai trò |
|---|---|
| `src/octop/overlay/migrations/` | SQL đánh số từ `001`, tách khỏi `src/octop/infra/db/migrations/` của upstream |
| `_overlay_schema_version` | ledger riêng, một dòng `version` |
| `run_overlay_migrations(db)` | bỏ qua version ≤ ledger; áp xong mới ghi ledger |
| `src/octop/infra/server.py` (patch) | gọi ngay sau `run_migrations(db)` ở **hai** điểm boot: `start()` và `bind_control_plane()` |

Vì sao không dùng chung dải số với upstream: dải `025+` thuộc upstream. Nếu overlay chen vào, lần nâng base lên 025 sẽ làm `_discover()` ném `Duplicate migration version 025` và **container chết lúc khởi động**. Hai ledger độc lập nghĩa là bỏ lớp overlay cũng không đụng `_schema_version` của upstream.

Chi tiết runner: `_discover(dialect)` lọc `NNN_*.sql` (bỏ `.pg.sql` khi SQLite) hoặc `NNN_*.pg.sql` (Postgres), ném `RuntimeError` khi trùng số. SQLite chạy `conn.executescript`; Postgres tách câu bằng `re.compile(r";\s*\n")` rồi `conn.execute` từng câu trong `conn.transaction()`. Không import gì từ `octop.infra.db.migrate` — hai lớp tiến hoá độc lập.

DDL viết `IF NOT EXISTS` để tự lành khi ledger lệch DB.

## 7. Patch và file — danh sách đầy đủ

`patches/manifest.yaml` document `id: agency`, `base_commit: 890111b7`.

| Patch | Anchor | Thay đổi |
|---|---|---|
| `dashboard/src/layouts/sidebarNav.tsx` | import `GraduationCap`; `SIDEBAR_NAV_KEYS`; block `navAllowed(user, "experts")` | thêm `Building2`; key `"agencies"`; push item `/agencies` **trước** Experts, gate `if (user)` |
| `…/sidebarNavLayout.test.ts` | mảng `ungrouped` mặc định | thêm `"agencies"` sau `"chat"` |
| `dashboard/src/routes/index.tsx` | khối `lazy(...)`; `pathToKey`; `routeConfigs` | `AgenciesPage` lazy; `/agencies` + `/agencies/:agencyId`; `pathToKey`; `resolveSelectedKey` |
| `dashboard/src/routes/prefetch.ts` | `"/experts": …` | `"/agencies": () => import("../pages/Agencies")` |
| `…/Experts/components/EditAgentDrawer.tsx` | khối `Form.Item` màu | 1 import + `<AgentAgencyPicker agentId={agent.agent_id} />` — patch 2 dòng |
| `dashboard/src/locales/en.json`, `zh.json` | trước `"experts": {`; sau `nav.experts` | `nav.agencies` + nhóm `agencies.*` (37 dòng/file, 35 leaf key) |
| `src/octop/api/app.py` | import routers; `_RouterMount` | `agencies` + `_RouterMount(…, "/api/agencies", ["agencies"])` |
| `src/octop/infra/server.py` | import `run_migrations`; 2 chỗ gọi | import + `run_overlay_migrations(db)` ngay sau cả hai |
| `src/octop/infra/users/preferences.py` | frozenset `SIDEBAR_NAV_KEYS` | thêm `"agencies"` |

`dashboard/src/layouts/sidebarNav.test.ts` **không** sửa: nó so tập key với chính hằng `SIDEBAR_NAV_KEYS`, thêm key vào mảng là đủ. `sidebarNavLayout.test.ts` phải sửa vì khẳng định cứng thứ tự nav mặc định.

File mới: xem §3. `vi.json` sửa trực tiếp trong `src/` (không patch), parity `missing 0 | extra 0` do `scripts/vi-i18n/check_parity.py` kiểm.

**Kiểm lỗi thời.** `patches/lock.json` giữ sha256 upstream của từng file dưới đây tại `890111b7`; `scripts/patch_status.py` báo `STALE agency` khi một trong số đó đã đổi ở submodule. Danh sách file + hash đầy đủ: [00-PATCH-REGISTRY §4](00-PATCH-REGISTRY.md). Cột "Anchor" ở trên chính là đoạn code cần tìm lại khi rebase — số dòng trong file patch sẽ trôi, anchor thì không.

Patch nặng nhất khi rebase: `src/octop/infra/server.py` (gắn `run_overlay_migrations` vào 2 điểm boot) và `locales/en.json`/`zh.json` (anchor là ngữ cảnh JSON, dễ lệch nếu upstream chèn nhóm key khác cùng chỗ).

## 8. Kiểm thử

| Mức | Lệnh | Kỳ vọng |
|---|---|---|
| Migration | `python octop-orchester/scripts/overlay_selfcheck.py` (**trong image**) | `OK: idempotent, agency+webhook tables created, deletes cascade` |
| Route order | `python octop-orchester/scripts/agencies_route_selfcheck.py` | `OK: 8 routes, by-agent declared before /{agency_id}` |
| API | `python octop-orchester/scripts/agencies_api_smoke.py` (container đang chạy) | 8 endpoint pass, tự dọn |
| FE | `npm run test` trong `dashboard/` | `sidebarNav.test.ts`, `sidebarNavLayout.test.ts`, `agency.test.ts` pass |
| Build | `docker compose build --no-cache --progress=plain 2>&1 \| grep -E "applying\|FAILED:"` | 10 dòng `agency` (tổng 42 cùng `vi-i18n`/`en-default`/`org-chart`/`webhook`), không `FAILED` |
| Ledger | `docker exec octop-orchester python -c "…"` (§6 README) | `[(1,)]`, `['agency','agency_member']`, giữ nguyên sau restart |
| i18n | `python octop-orchester/scripts/vi-i18n/check_parity.py` | `missing 0 \| extra 0` |

`overlay_selfcheck.py` graft package `octop.overlay` từ `src/` bằng `importlib` — nhưng vẫn `import octop.infra...` từ submodule, nên cần Python ≥ 3.12 (repo dùng PEP 695). Trên host Python 3.10 phải chạy trong image; `agencies_route_selfcheck.py` và `orgchart_route_selfcheck.py` thì thuần AST, chạy trên host được.

## 9. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Patch `EditAgentDrawer.tsx` (1493 dòng) lệch khi nâng base | Patch chỉ 2 dòng; thân component nằm ở file mới `AgentAgencyPicker.tsx` |
| Upstream nâng base làm patch fail | `manifest.yaml` ghi `base_commit`; quy trình rebase ở README §8 |
| `UNIQUE(name)` + mạng chậm → user bấm tạo 2 lần | Nút submit disable khi đang gửi; 409 có message riêng |
| Ai cũng xóa được → xóa nhầm | `Modal.confirm` nêu rõ agent không bị xóa; thiệt hại tối đa là liên kết |
| Route `/{agency_id}` nuốt `by-agent` | Khai báo `by-agent` trước + self-check AST |

## 10. Tiêu chí hoàn thành

1. Build sạch, không `FAILED`.
2. Menu "Phòng ban" hiện với mọi user đã đăng nhập, không cần quyền admin.
3. Create/update/delete chạy được; trùng tên → 409.
4. Gán agent từ cả hai màn hình thấy cùng dữ liệu.
5. Trang chi tiết hiện agent + kênh suy ra đúng.
6. Xóa phòng ban không xóa agent; xóa agent tự rời phòng ban.
7. Restart container không áp lại migration.
8. `check_parity.py` sạch.

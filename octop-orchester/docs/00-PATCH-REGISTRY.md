# Sổ đăng ký patch và kiểm tra lỗi thời

| Dự án | Octop-Orchester |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-10-30 |
| Base | `octop/` @ `890111b7` (v0.9.16-824-g890111b7, tag v1.0.3b1) |
| Tham chiếu | [README](../README.md), [01-AGENCY](01-AGENCY-ARCHITECTURE.md), [02-ORGCHART](02-ORGCHART-ARCHITECTURE.md), [03-WEBHOOK](03-WEBHOOK-ARCHITECTURE.md) |

Tài liệu này trả lời một câu hỏi duy nhất: **khi octop lên version mới, patch nào của mình đã lỗi thời và phải làm lại?** Ba tài liệu kiến trúc kia nói *chức năng làm gì*; tài liệu này nói *nó gắn vào upstream ở đâu và còn gắn được không*.

## 1. Chức năng đã bổ sung

| # | Chức năng | Tài liệu kiến trúc | Patch id | Vào UI ở đâu | Số patch / file mới |
|---|---|---|---|---|---|
| 1 | **Phòng ban (Agency)** — CRUD phòng ban, gán expert, xem kênh | [01-AGENCY](01-AGENCY-ARCHITECTURE.md) | `agency` | Sidebar → **Phòng ban** (`/agencies`, `/agencies/:agencyId`); thêm khối chọn phòng ban trong drawer sửa expert | 10 / 14 |
| 2 | **Sơ đồ tổ chức (Org Chart)** — canvas Tổ chức → Phòng ban → Expert | [02-ORGCHART](02-ORGCHART-ARCHITECTURE.md) | `org-chart` | Sidebar → **Sơ đồ tổ chức** (`/org-chart`); click card → `/agencies/:id` hoặc `/experts?agent=<id>` | 11 / 7 |
| 3 | **Webhook sự kiện agent** — đẩy mọi trajectory event ra URL ngoài, có ký + retry | [03-WEBHOOK](03-WEBHOOK-ARCHITECTURE.md) | `webhook` | Sidebar → **Cài đặt ứng dụng** → tab **Webhook** (`/admin/advanced?tab=webhooks`) | 7 / 10 |
| 4 | **Flows** — danh sách + thêm flow + khung builder (dữ liệu giả; node làm dần, backend sau) | [04-FLOWS](04-FLOWS-ARCHITECTURE.md), [05-FLOWS-NODE-GUIDE](05-FLOWS-NODE-GUIDE.md) | `workflow-ui` | Sidebar → **Luồng tự động** (`/flows`, `/flows/:flowId`) | 7 / 48 |
| — | **Tiếng Việt (vi)** — locale đầy đủ cho dashboard + backend | [README §4](../README.md) | `vi-i18n` | Bộ chọn ngôn ngữ ở avatar dropdown, trang Setup, trang Invite | 13 / 2 |
| — | **Mặc định tiếng Anh** — cài mới không rơi về tiếng Trung | [README §4.11](../README.md) | `en-default` | Trang Setup lần đầu | 1 / 0 |

`vi-i18n` và `en-default` không thuộc ba chức năng nghiệp vụ nhưng nằm cùng cơ chế patch; tài liệu này theo dõi luôn cả hai để một lần kiểm tra là đủ.

Copyright: `webhook` **phụ thuộc** `agency` (dùng overlay migration runner do `agency` cài). `org-chart` cũng phụ thuộc `agency` (đọc bảng `agency`/`agency_member`). Thứ tự áp bắt buộc: `agency` → `org-chart` → `webhook`; `workflow-ui` phải xếp sau `org-chart` (áp theo tên file) vì hunk của nó nằm cạnh dòng org-chart thêm vào.

## 2. Hai lớp thay đổi

Mỗi chức năng được ghép từ hai lớp, cả hai đều nằm ngoài `octop/`:

| Lớp | Vị trí | Cơ chế | Khi nào dùng |
|---|---|---|---|
| **File mới** | `octop-orchester/src/<đường-dẫn-y-hệt-octop/>` | Docker `COPY` đè lên `/app/src/` | Toàn bộ code mới: router, page, overlay package, migration |
| **Patch** | `octop-orchester/patches/<đường-dẫn>.<patch-id>.patch` | `git apply --whitespace=nowarn` từ `/app` (backend) hoặc `/build` (dashboard) | Chỉ những điểm **buộc** phải nối vào file upstream có sẵn |

Không có extension point cho router/route/sidebar của Octop — xem [03-WEBHOOK §2](03-WEBHOOK-ARCHITECTURE.md#vì-sao-cần-patch-không-chỉ-config). `octop.infra.agents.plugins` chỉ dành cho agent tool, không mount được FastAPI router hay trang dashboard.

Điểm mấu chốt để kiểm tra lỗi thời: **chỉ lớp patch mới có thể vỡ**. File mới không phụ thuộc upstream trừ khi upstream tạo ra file cùng đường dẫn (xem `--collisions` §5).

## 3. Cấu trúc folder

```
octop-orchester/
├── src/                                            ← LỚP FILE MỚI (33 file)
│   ├── src/octop/overlay/                          → COPY vào /app/src/octop/overlay/
│   │   ├── __init__.py, migrate.py                 runner migration overlay + ledger riêng
│   │   ├── migrations/001_agency.sql|.pg.sql       bảng agency, agency_member
│   │   ├── migrations/002_webhook.sql|.pg.sql      bảng webhook_endpoint, webhook_delivery
│   │   └── webhook/{__init__,store,dispatcher,signing}.py  outbox, ký HMAC, SSRF guard
│   ├── src/octop/api/routers/{agencies,orgchart,webhooks}.py
│   ├── src/octop/i18n/vi.json                      locale vi phía backend
│   ├── dashboard/src/pages/{Agencies,OrgChart,Settings/Webhooks}/
│   ├── dashboard/src/api/modules/{agency,agency.test,orgChart,webhooks}.ts
│   └── dashboard/src/locales/vi.json               locale vi nguyên file
├── patches/                                        ← LỚP PATCH (42 file)
│   ├── manifest.yaml                               đăng ký patch (người đọc)
│   ├── lock.json                                   base_commit + sha256 (máy đọc)
│   ├── dashboard-pkg/                              áp TRƯỚC npm ci
│   ├── dashboard/                                  áp sau khi COPY source
│   └── src/                                        áp từ /app (backend)
├── scripts/patch_status.py                         kiểm tra lỗi thời (tài liệu này)
├── docs/00-PATCH-REGISTRY.md                       tài liệu này
└── docs/0{1,2,3}-*-ARCHITECTURE.md                 kiến trúc từng chức năng
```

`src/` mirror đúng cây `octop/`: `src/` trong `octop/` ← `src/` trong `octop-orchester/`, `dashboard/` ← `dashboard/`. Docker `COPY` hai nhánh riêng (`/app/src/` và `/build/`), nên không có tiền tố lặp.

Tên file patch có dạng `<đường-dẫn-tính-từ-gốc-octop>.<patch-id>.patch`. Script đọc patch id từ chính tên file, **không** đọc `manifest.yaml` — nên không thể lệch nhau.

## 4. Sổ patch đầy đủ (sinh tự động)

Sinh lại bằng `python octop-orchester/scripts/patch_status.py --report` sau mỗi lần `--record`. Đừng sửa tay.

<!-- BEGIN GENERATED -->
<!-- generated by scripts/patch_status.py --report; do not edit by hand -->

Base: `890111b7879665840414ca28ab168b05b0db0921` (v1.0.3b1) — recorded 2026-10-30T18:27:59+0700

| # | Patch id | Patch file | Target file | Upstream sha256 (12) | Commit |
|---|---|---|---|---|---|
| 1 | `agency` | `dashboard/src/layouts/sidebarNav.tsx.agency.patch` | `dashboard/src/layouts/sidebarNav.tsx` | `96b5ca4bd063` | `uncommitted` |
| 2 | `agency` | `dashboard/src/layouts/sidebarNavLayout.test.ts.agency.patch` | `dashboard/src/layouts/sidebarNavLayout.test.ts` | `c036c88673d2` | `uncommitted` |
| 3 | `agency` | `dashboard/src/locales/en.json.agency.patch` | `dashboard/src/locales/en.json` | `b6cfab209198` | `uncommitted` |
| 4 | `agency` | `dashboard/src/locales/zh.json.agency.patch` | `dashboard/src/locales/zh.json` | `c19b07212714` | `uncommitted` |
| 5 | `agency` | `dashboard/src/pages/Experts/components/EditAgentDrawer.tsx.agency.patch` | `dashboard/src/pages/Experts/components/EditAgentDrawer.tsx` | `0268f9e447cb` | `uncommitted` |
| 6 | `agency` | `dashboard/src/routes/index.tsx.agency.patch` | `dashboard/src/routes/index.tsx` | `3d39919249e0` | `uncommitted` |
| 7 | `agency` | `dashboard/src/routes/prefetch.ts.agency.patch` | `dashboard/src/routes/prefetch.ts` | `daafd3c9dbc1` | `uncommitted` |
| 8 | `agency` | `src/octop/api/app.py.agency.patch` | `src/octop/api/app.py` | `33ff52343b32` | `uncommitted` |
| 9 | `agency` | `src/octop/infra/server.py.agency.patch` | `src/octop/infra/server.py` | `631a0456df97` | `uncommitted` |
| 10 | `agency` | `src/octop/infra/users/preferences.py.agency.patch` | `src/octop/infra/users/preferences.py` | `3bd0e85eb5f3` | `uncommitted` |
| 11 | `en-default` | `src/octop/cli/commands/init.py.en-default.patch` | `src/octop/cli/commands/init.py` | `f024dec1f4ef` | `uncommitted` |
| 12 | `org-chart` | `dashboard-pkg/dashboard/package-lock.json.org-chart.patch` | `dashboard/package-lock.json` | `95f3236b2aa4` | `uncommitted` |
| 13 | `org-chart` | `dashboard-pkg/dashboard/package.json.org-chart.patch` | `dashboard/package.json` | `af10125782e4` | `uncommitted` |
| 14 | `org-chart` | `dashboard/src/layouts/sidebarNav.tsx.org-chart.patch` | `dashboard/src/layouts/sidebarNav.tsx` | `96b5ca4bd063` | `uncommitted` |
| 15 | `org-chart` | `dashboard/src/layouts/sidebarNavLayout.test.ts.org-chart.patch` | `dashboard/src/layouts/sidebarNavLayout.test.ts` | `c036c88673d2` | `uncommitted` |
| 16 | `org-chart` | `dashboard/src/locales/en.json.org-chart.patch` | `dashboard/src/locales/en.json` | `b6cfab209198` | `uncommitted` |
| 17 | `org-chart` | `dashboard/src/locales/zh.json.org-chart.patch` | `dashboard/src/locales/zh.json` | `c19b07212714` | `uncommitted` |
| 18 | `org-chart` | `dashboard/src/pages/Experts/index.tsx.org-chart.patch` | `dashboard/src/pages/Experts/index.tsx` | `cdac54319f45` | `uncommitted` |
| 19 | `org-chart` | `dashboard/src/routes/index.tsx.org-chart.patch` | `dashboard/src/routes/index.tsx` | `3d39919249e0` | `uncommitted` |
| 20 | `org-chart` | `dashboard/src/routes/prefetch.ts.org-chart.patch` | `dashboard/src/routes/prefetch.ts` | `daafd3c9dbc1` | `uncommitted` |
| 21 | `org-chart` | `src/octop/api/app.py.org-chart.patch` | `src/octop/api/app.py` | `33ff52343b32` | `uncommitted` |
| 22 | `org-chart` | `src/octop/infra/users/preferences.py.org-chart.patch` | `src/octop/infra/users/preferences.py` | `3bd0e85eb5f3` | `uncommitted` |
| 23 | `vi-i18n` | `dashboard/src/App.tsx.vi-i18n.patch` | `dashboard/src/App.tsx` | `2d9bb6c3908f` | `uncommitted` |
| 24 | `vi-i18n` | `dashboard/src/api/modules/decision.ts.vi-i18n.patch` | `dashboard/src/api/modules/decision.ts` | `30711e8b9f84` | `uncommitted` |
| 25 | `vi-i18n` | `dashboard/src/api/request.ts.vi-i18n.patch` | `dashboard/src/api/request.ts` | `fee14bc73ca3` | `uncommitted` |
| 26 | `vi-i18n` | `dashboard/src/components/AvatarDropdown.tsx.vi-i18n.patch` | `dashboard/src/components/AvatarDropdown.tsx` | `4e764ad18547` | `uncommitted` |
| 27 | `vi-i18n` | `dashboard/src/i18n.ts.vi-i18n.patch` | `dashboard/src/i18n.ts` | `28b8d74a7a2b` | `uncommitted` |
| 28 | `vi-i18n` | `dashboard/src/locales/en.json.vi-i18n.patch` | `dashboard/src/locales/en.json` | `b6cfab209198` | `uncommitted` |
| 29 | `vi-i18n` | `dashboard/src/locales/zh.json.vi-i18n.patch` | `dashboard/src/locales/zh.json` | `c19b07212714` | `uncommitted` |
| 30 | `vi-i18n` | `dashboard/src/pages/Invite/index.tsx.vi-i18n.patch` | `dashboard/src/pages/Invite/index.tsx` | `6f3b61039362` | `uncommitted` |
| 31 | `vi-i18n` | `dashboard/src/pages/Setup/index.tsx.vi-i18n.patch` | `dashboard/src/pages/Setup/index.tsx` | `5772129aaf6e` | `uncommitted` |
| 32 | `vi-i18n` | `dashboard/src/utils/localePrefs.ts.vi-i18n.patch` | `dashboard/src/utils/localePrefs.ts` | `63dbfa4a9079` | `uncommitted` |
| 33 | `vi-i18n` | `src/octop/api/routers/preferences.py.vi-i18n.patch` | `src/octop/api/routers/preferences.py` | `d41d1f2b63be` | `uncommitted` |
| 34 | `vi-i18n` | `src/octop/i18n/loader.py.vi-i18n.patch` | `src/octop/i18n/loader.py` | `858ad4f15ab2` | `uncommitted` |
| 35 | `vi-i18n` | `src/octop/infra/utils/locale.py.vi-i18n.patch` | `src/octop/infra/utils/locale.py` | `db0cf205e758` | `uncommitted` |
| 36 | `webhook` | `dashboard/src/locales/en.json.webhook.patch` | `dashboard/src/locales/en.json` | `b6cfab209198` | `uncommitted` |
| 37 | `webhook` | `dashboard/src/locales/zh.json.webhook.patch` | `dashboard/src/locales/zh.json` | `c19b07212714` | `uncommitted` |
| 38 | `webhook` | `dashboard/src/pages/Settings/AdvancedSettings/index.tsx.webhook.patch` | `dashboard/src/pages/Settings/AdvancedSettings/index.tsx` | `18198d516bc1` | `uncommitted` |
| 39 | `webhook` | `dashboard/src/utils/permissions.ts.webhook.patch` | `dashboard/src/utils/permissions.ts` | `384c4d94317b` | `uncommitted` |
| 40 | `webhook` | `src/octop/api/app.py.webhook.patch` | `src/octop/api/app.py` | `33ff52343b32` | `uncommitted` |
| 41 | `webhook` | `src/octop/infra/history/trajectory/service.py.webhook.patch` | `src/octop/infra/history/trajectory/service.py` | `4a2864cf194b` | `uncommitted` |
| 42 | `webhook` | `src/octop/infra/server.py.webhook.patch` | `src/octop/infra/server.py` | `631a0456df97` | `uncommitted` |
| 43 | `workflow-ui` | `dashboard/src/layouts/sidebarNav.tsx.workflow-ui.patch` | `dashboard/src/layouts/sidebarNav.tsx` | `96b5ca4bd063` | `uncommitted` |
| 44 | `workflow-ui` | `dashboard/src/layouts/sidebarNavLayout.test.ts.workflow-ui.patch` | `dashboard/src/layouts/sidebarNavLayout.test.ts` | `c036c88673d2` | `uncommitted` |
| 45 | `workflow-ui` | `dashboard/src/locales/en.json.workflow-ui.patch` | `dashboard/src/locales/en.json` | `b6cfab209198` | `uncommitted` |
| 46 | `workflow-ui` | `dashboard/src/locales/zh.json.workflow-ui.patch` | `dashboard/src/locales/zh.json` | `c19b07212714` | `uncommitted` |
| 47 | `workflow-ui` | `dashboard/src/routes/index.tsx.workflow-ui.patch` | `dashboard/src/routes/index.tsx` | `3d39919249e0` | `uncommitted` |
| 48 | `workflow-ui` | `dashboard/src/routes/prefetch.ts.workflow-ui.patch` | `dashboard/src/routes/prefetch.ts` | `daafd3c9dbc1` | `uncommitted` |
| 49 | `workflow-ui` | `src/octop/infra/users/preferences.py.workflow-ui.patch` | `src/octop/infra/users/preferences.py` | `3bd0e85eb5f3` | `uncommitted` |

49 patched file(s) across 6 patch id(s); 80 overlay file(s) added by `src/`.
<!-- END GENERATED -->

## 5. Kiểm tra lỗi thời — `scripts/patch_status.py`

Stdlib only, không cần Docker, không cần cài gì.

| Lệnh | Việc | Exit code |
|---|---|---|
| `python octop-orchester/scripts/patch_status.py` | So sha256 upstream hiện tại với `lock.json`; báo patch nào lỗi thời | 0 sạch, 1 có vấn đề |
| `--apply-check` | Export `octop/` @ HEAD ra temp, `git apply` toàn bộ 42 patch thật | 0 áp hết, 1 có patch hỏng |
| `--record` | Sinh lại `patches/lock.json` (chỉ chạy khi `octop/` sạch và patch áp sạch) | 0 / 1 / 2 |
| `--collisions` | File trong `src/` mà upstream **đã có** — `COPY` sẽ đè mất code upstream | 1 nếu có |
| `--history` | Bảng patch id ↔ commit đã đưa patch vào (đọc từ `git log`, luôn tươi) | 0 |
| `--report` | Sinh lại §4 của tài liệu này | 0 / 2 |

### Vì sao cần hash, không chỉ `git apply`

`git apply` chỉ báo khi patch **không áp được**. Nó im lặng khi patch **vẫn áp được nhưng đã sai** — upstream reindent anchor, hunk khớp theo context, kết quả lệch ý mà build vẫn xanh. `lock.json` lưu hai hash cho mỗi file:

- `upstream_sha256` — file upstream tại `base_commit`, **trước** khi áp patch. Đây là thứ phát hiện lỗi thời.
- `patched_sha256` — file sau khi áp. Dùng để soát khi rebase: patch mới phải sinh ra đúng nội dung này (hoặc cố ý khác, thì `--record` lại).

Script còn soát hash từng file trong `src/` (`adds`) — sửa file overlay mà quên `--record` sẽ bị báo.

### Vì sao đọc patch id từ tên file, không từ manifest

`manifest.yaml` là tài liệu cho người đọc (mục tiêu, lý do, anchor). Nếu script tin manifest thì một patch thêm vào mà quên khai báo sẽ không được kiểm tra. Đọc từ `diff --git` line trong thân patch là nguồn sự thật duy nhất: **42/42 file patch đều được phủ**, `--history` báo `UNCOMMITTED` cho patch chưa commit.

## 6. Quy trình khi Octop lên version

```bash
# 0. Xem mình đang đứng ở đâu
python octop-orchester/scripts/patch_status.py
python octop-orchester/scripts/patch_status.py --history

# 1. Nâng submodule
cd octop && git fetch && git checkout <commit-mới> && cd ..

# 2. Có gì đã đổi? Script nêu đúng file + đúng patch cần xem lại
python octop-orchester/scripts/patch_status.py

# 3. Thử áp thật — bắt được lỗi hunk cụ thể mà bước 2 không thấy
python octop-orchester/scripts/patch_status.py --apply-check

# 4. Kiểm file mới có bị upstream chiếm chỗ không
python octop-orchester/scripts/patch_status.py --collisions

# 5. Rebase từng patch hỏng (README §8.2), rồi:
python octop-orchester/scripts/patch_status.py --apply-check   # phải sạch
python octop-orchester/scripts/patch_status.py --record        # khoá base mới
python octop-orchester/scripts/patch_status.py --report        # cập nhật §4
# sửa base_commit trong patches/manifest.yaml + dòng Base của 4 tài liệu
```

Bước 2 và 3 bù cho nhau: bước 2 nói **file nào** đã đổi (kể cả đổi mà patch vẫn áp được), bước 3 nói **patch nào** không áp được nữa. Chạy cả hai trước khi sửa tay.

### Giao việc cho agent khi rebase

Đưa agent ba thứ, theo thứ tự:

1. Tài liệu kiến trúc của chức năng bị ảnh hưởng (`01`/`02`/`03`) — để biết patch đó *định làm gì*.
2. Bảng §4 của tài liệu này — danh sách file + hash upstream cũ.
3. Output của `patch_status.py --apply-check` — lỗi hunk thật.

Prompt đủ dùng:

> Base đang là `<commit cũ>`, nay nâng lên `<commit mới>`. Chạy `python octop-orchester/scripts/patch_status.py` và `--apply-check` để lấy danh sách patch hỏng. Với từng patch: đọc ý định trong `octop-orchester/docs/0N-...md` §"Patch và file", rebase theo README §8.2, rồi chạy lại `--apply-check` cho tới khi sạch. Không sửa `lock.json` bằng tay.

Ràng buộc phải nói rõ với agent: **không** sửa file trong `octop/` (submodule phải sạch trước build), **không** sửa `src/` để "cho khớp" patch — nếu patch phải đổi đường dẫn thì đó là quyết định kiến trúc, cần bạn duyệt.

## 7. Trạng thái hiện tại

| Kiểm tra | Kết quả (2026-10-30) |
|---|---|
| `patch_status.py` | 0 patch lỗi thời, 0 file overlay lệch |
| `--apply-check` | 42/42 patch áp sạch trên `890111b7` |
| `--collisions` | 0 — không file nào trong `src/` đè lên file upstream |
| `--history` | 5 patch id, 42 file; **tất cả còn `UNCOMMITTED`** |
| `lock.json` `adds` | 33 mục, khớp 33 file thực có trong `src/` (không thừa, không thiếu) |
| `webhook_selfcheck.py` | `ALL OK` (sign / envelope / matches / backoff / validate_url / clean_headers / store) |
| `overlay_selfcheck.py` | `OK: idempotent, agency+webhook tables created, deletes cascade` |
| `webhook_e2e.py` | `ALL OK — 16 deliveries, 14 event types, every HMAC verified` |
| `agencies_route_selfcheck.py` | `OK: 8 routes, by-agent declared before /{agency_id}` |
| `orgchart_route_selfcheck.py` | `OK orgchart router: 1 route, GET /org-graph` |

Ba selfcheck Python chạy được trên máy host; bốn cái cần `octop` import được (`webhook_selfcheck`, `overlay_selfcheck`, `webhook_e2e`, hai smoke HTTP) phải chạy trong image — Python 3.10 trên host không đọc nổi PEP 695 trong `octop/src/octop/infra/db/repos/_base.py`:

`UNCOMMITTED` là việc cần làm: bộ patch `dashboard/`, `dashboard-pkg/`, `src/`, `src/` overlay và `lock.json` hiện chưa được commit (xem `git status`). Sau khi commit, `--history` sẽ hiện commit SHA thật cho từng patch, và đó là mốc để đối chiếu khi rebase.

```bash
docker cp octop-orchester/scripts/webhook_selfcheck.py octop-orchester:/tmp/w.py
docker exec octop-orchester python /tmp/w.py
```

## 8. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Patch áp được nhưng sai ý do upstream reindent | `lock.json` giữ sha256 upstream; `patch_status.py` báo trước khi build |
| `octop/` bẩn làm patch áp hai lần | `--record`/`--apply-check` từ chối chạy khi `git status --porcelain` khác rỗng |
| Upstream tạo file trùng đường dẫn với `src/` | `--collisions` — `COPY` sẽ đè im lặng, đây là lỗi khó thấy nhất |
| Sửa `src/` mà quên `--record` | `adds` hash soát từng file, báo "drifted" |
| Quên patch nào tồn tại | Patch id đọc từ tên file, không từ manifest; `--history` liệt kê đủ |
| `package-lock.json` của `org-chart` sinh bằng npm, không viết tay | Áp trong `patches/dashboard-pkg/` **trước** `npm ci`; sửa `package.json` phải sinh lại lock |

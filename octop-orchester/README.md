# Octop-Orchester

Lớp tuỳ biến của Octop. Toàn bộ thay đổi nằm trong folder này; **không sửa trực tiếp `octop/`** (submodule upstream).

- `../octop/` — submodule upstream, đang neo ở `890111b7` (`v0.9.16-824-g890111b7`, tag `v1.0.3b1`).
- `../orchester/` — submodule upstream thứ hai.
- Folder này — Dockerfile, compose, patch, file mới, script.

---

## 1. Mục tiêu

Octop upstream chỉ có hai locale: `zh` và `en`. Mục tiêu của lớp tuỳ biến này là **thêm tiếng Việt (`vi`) làm locale thứ ba**, dùng được ở cả dashboard lẫn backend, không làm hỏng `zh`/`en`.

Cụ thể cần đạt:

1. `vi` là locale hợp lệ ở backend — nhận qua header `Accept-Language`, lưu được vào preference `locale`, dùng được khi resolve ngôn ngữ cho response.
2. Dashboard có bộ chọn thứ ba "Tiếng Việt" ở mọi chỗ người dùng thực sự chọn được ngôn ngữ.
3. Các component dựng sẵn của antd (DatePicker, Pagination, Modal, Popconfirm, Empty…) và dayjs cũng hiển thị tiếng Việt, không chỉ chuỗi của riêng Octop.
4. Request lên backend mang đúng locale đang chọn, để label tool/skill trả về bằng tiếng Việt.
5. Thiếu key nào trong bản dịch thì fallback `en`, không hiện raw key.

---

## 2. Cấu trúc folder

```
octop-orchester/                     # ← folder này
├── Dockerfile                      # FROM image base (dựng từ octop/docker/Dockerfile), thêm lớp tuỳ biến
├── docker-compose.yml              # build 2 service: octop-base → octop
├── .env                            # OCTOP_PORT, OCTOP_DATA (mount ra host) — KHÔNG commit
├── docker/
│   └── octop-entrypoint.sh         # wrapper: đồng bộ venv khi image đổi, rồi gọi entrypoint upstream
├── patches/                        # SỬA file đã có của octop
│   ├── manifest.yaml
│   ├── dashboard/src/App.tsx.vi-i18n.patch
│   ├── dashboard/src/i18n.ts.vi-i18n.patch
│   ├── ...
│   ├── dashboard/src/routes/index.tsx.agency.patch
│   └── src/octop/api/app.py.agency.patch
├── src/                            # THÊM file mới, đường dẫn y hệt bên octop
│   ├── dashboard/src/locales/vi.json
│   ├── dashboard/src/pages/Agencies/…
│   ├── src/octop/i18n/vi.json
│   └── src/octop/overlay/migrations/001_agency.sql
└── scripts/
    ├── vi-i18n/                    # pipeline dịch (xem §7)
    │   ├── sync_batches.py
    │   ├── merge.py
    │   ├── check_parity.py
    │   ├── backend/      backend_vi/
    │   └── dashboard/    dashboard_vi/
    ├── add_agencies_i18n.py        # chèn khoá agencies.* vào en/zh/vi
    ├── overlay_selfcheck.py        # migration overlay chạy 2 lần không đổi gì
    └── agencies_route_selfcheck.py # by-agent khai báo trước /{agency_id}
```

Các lệnh dưới đây ghi đường dẫn tính từ **repo root** (thư mục cha của `octop-orchester/`), tức `octop-orchester/scripts/...` — trừ khi ghi rõ "từ `octop-orchester/`".

Hai quy ước, không có ngoại lệ:

- **Patch** đặt tại `patches/<đường-dẫn-y-hệt-octop>.vi-i18n.patch`. Ví dụ sửa `octop/dashboard/src/App.tsx` → `patches/dashboard/src/App.tsx.vi-i18n.patch`. Nhìn đường dẫn là biết nó đụng file nào bên octop, khỏi tra cứu. Đuôi `.vi-i18n.patch` là id của patch — thêm patch khác thì đặt `<path>.<patch-id>.patch`, các file không đụng nhau.
- **File mới** đặt tại `src/<đường-dẫn-y-hệt-octop>`. Ví dụ `octop/dashboard/src/locales/vi.json` → `src/dashboard/src/locales/vi.json`. Không sinh patch `--- /dev/null` cho file mới: file mới chỉ là bản copy, đọc trực tiếp dễ hơn đọc diff 7000 dòng.

Lý do tách: file mới không bao giờ conflict khi upgrade (không có gì để rebase), còn file sửa thì phải theo dõi từng hunk. Trộn hai loại vào một `patch.diff` khiến mỗi lần upgrade phải đọc lại cả 8700 dòng dù 99% là JSON bản dịch.

---

## 3. Octop upstream hiện có gì

Đây là baseline tại `890111b7`. Khi upgrade, so lại phần này trước — nếu upstream đã thay đổi chính những đoạn dưới, patch tương ứng sẽ fail và cần rebase.

### Backend

`src/octop/infra/utils/locale.py` — danh sách locale bị hardcode bằng `Literal`, không có extension point:

```python
Locale = Literal["zh", "en"]

DEFAULT_LOCALE: Locale = "zh"
SUPPORTED_LOCALES: tuple[Locale, ...] = ("zh", "en")

def normalize_locale(raw: str | None) -> Locale:
    ...
    return "en"
```

`src/octop/i18n/loader.py` — `_load_all()` chỉ nạp hai file JSON:

```python
for loc in ("en", "zh"):
    raw = resources.files("octop.i18n").joinpath(f"{loc}.json").read_text(encoding="utf-8")
```

`src/octop/i18n/` chỉ có `en.json`, `zh.json`, `loader.py`. Không có cơ chế drop-in thêm file locale.

`src/octop/api/routers/preferences.py` — trường `locale` là chuỗi tự do, chỉ docstring nói `zh` hoặc `en`; API không validate danh sách locale.

### Frontend

`dashboard/src/i18n.ts` — chỉ import hai bundle, `supportedLngs` chốt hai phần tử:

```ts
async function loadLocaleBundle(locale: UiLocale) {
  if (locale === "zh") {
    return (await import("./locales/zh.json")).default;
  }
  return (await import("./locales/en.json")).default;
}
...
supportedLngs: ["zh", "en"],
```

Đoạn chọn locale còn lặp lại ở 4 chỗ, mỗi chỗ một kiểu:

```ts
const locale = lng.startsWith("zh") ? "zh" : "en";          // hydrateToolLabels, hydrateServerLabels
const locale: UiLocale = lng.startsWith("zh") ? "zh" : "en"; // languageChanged
const fallback: UiLocale = initial === "zh" ? "en" : "zh";
```

`dashboard/src/utils/localePrefs.ts` — nguồn sự thật của locale phía UI:

```ts
export type UiLocale = "zh" | "en";
...
return raw.toLowerCase().startsWith("zh") ? "zh" : "en";
...
if (raw === "zh" || raw === "en") return raw;
...
document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
...
return normalizeUiLocale(locale) === "zh" ? "zh-CN" : "en-US";
```

`dashboard/src/locales/` chỉ có `en.json`, `zh.json`.

Ba chỗ người dùng **thực sự** chọn được ngôn ngữ — đều render antd `Segmented` với đúng hai option:

| File | Vị trí |
|---|---|
| `dashboard/src/components/AvatarDropdown.tsx` | menu tài khoản (sau khi đăng nhập) |
| `dashboard/src/pages/Setup/index.tsx` | wizard cài đặt lần đầu |
| `dashboard/src/pages/Invite/index.tsx` | trang nhận lời mời |

Hai file nữa trông như bộ chọn ngôn ngữ nhưng **không được import hay route ở đâu cả** — sửa chúng không có tác dụng gì:

- `dashboard/src/components/LanguageSwitcher.tsx`
- `dashboard/src/pages/Settings/Language/index.tsx`

(`grep -rn "LanguageSwitcher" dashboard/src` chỉ ra chính nó; `dashboard/src/routes/index.tsx` không có route `Language`.)

Hai nơi gửi header `Accept-Language`, đều tự viết lại logic:

```ts
"Accept-Language": i18n.language?.startsWith("zh") ? "zh" : "en",
```

- `dashboard/src/api/request.ts` — hai chỗ (`buildHeaders` và nhánh agent-scoped)
- `dashboard/src/api/modules/decision.ts` — một chỗ

`dashboard/src/App.tsx` — antd và dayjs cũng chỉ map hai locale:

```ts
const isZh = i18n.language?.toLowerCase().startsWith("zh") ?? false;
const antdLocale = isZh ? zhCN : enUS;
dayjs.locale(isZh ? "zh-cn" : "en");
```

`dashboard/src/locales/{en,zh}.json` — nhóm `account` có `langZh`, `langEn`, **không có** `langVi`.

### Không có đường tắt nào

Đã kiểm tra và loại trừ:

- **Setting**: không có setting nào thêm locale. Danh sách locale hardcode trong `Literal` (backend) và `supportedLngs` (frontend).
- **Public API**: `/api/preferences` chỉ lưu chuỗi `locale`, không làm hai phía biết thêm locale, cũng không cung cấp resource bundle.
- **Plugin**: plugin loader của Octop không có hook đăng ký locale bundle hay sửa `supportedLngs` lúc build dashboard.

Nên buộc phải patch source.

---

## 4. Đã điều chỉnh gì

49 patch (13 `vi-i18n` + 10 `agency` + 1 `en-default` + 11 `org-chart` + 7 `webhook` + 7 `workflow-ui`) + nhiều file mới (danh sách đầy đủ: [`docs/00-PATCH-REGISTRY.md`](docs/00-PATCH-REGISTRY.md)). Không đổi schema DB upstream; bảng `agency`/`agency_member` và `webhook_endpoint`/`webhook_delivery` do lớp overlay tự tạo qua ledger riêng.

Năm nhóm, áp theo thứ tự tên patch:

- **`vi-i18n`** — thêm tiếng Việt làm locale thứ ba (§4.1–4.8).
- **`agency`** — menu Phòng ban + lớp migration overlay (§4.9).
- **`en-default`** — cài mới mặc định tiếng Anh thay vì tiếng Trung (§4.11).
- **`org-chart`** — trang Sơ đồ tổ chức `/org-chart` + endpoint `GET /api/org-graph` (§4.12).
- **`webhook`** — đẩy trajectory event ra URL ngoài, có HMAC + outbox (§4.13).
- **`workflow-ui`** — Flows: danh sách, thêm flow, khung builder; node làm dần từng cái (§4.14). Phải xếp sau `org-chart`.

### 4.1. Backend

| Patch | Anchor (chuỗi phải tìm trong upstream) | Thay bằng |
|---|---|---|
| `src/octop/infra/utils/locale.py` | `Locale = Literal["zh", "en"]`<br>`SUPPORTED_LOCALES: tuple[Locale, ...] = ("zh", "en")`<br>cuối `normalize_locale` là `return "en"` | `Literal["zh", "en", "vi"]`, thêm `"vi"` vào tuple, thêm nhánh `if lower.startswith("vi"): return "vi"` |
| `src/octop/i18n/loader.py` | `for loc in ("en", "zh"):` | `for loc in ("en", "zh", "vi"):` |
| `src/octop/api/routers/preferences.py` | 2 docstring: `UI locale: \`zh\` or \`en\`.` | `UI locale: \`zh\`, \`en\`, or \`vi\`.` — chỉ docstring, hành vi không đổi |

### 4.2. Frontend — nguồn sự thật locale

| Patch | Anchor | Thay bằng |
|---|---|---|
| `dashboard/src/utils/localePrefs.ts` | `export type UiLocale = "zh" \| "en";` | `"zh" \| "en" \| "vi"` |
| | 2 nhánh detect browser (`for … if (lang.startsWith("en"))`, `if (primary.startsWith("en"))`) | thêm nhánh `vi` trước nhánh `en` |
| | `return raw.toLowerCase().startsWith("zh") ? "zh" : "en";` | tách thành 3 nhánh `zh`/`vi`/`en` |
| | `if (raw === "zh" \|\| raw === "en") return raw;` | thêm `\|\| raw === "vi"` |
| | `document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";` | bảng `{ zh: "zh-CN", en: "en", vi: "vi-VN" }` |
| | `return normalizeUiLocale(locale) === "zh" ? "zh-CN" : "en-US";` | thêm nhánh `vi-VN` (dùng cho STT) |

### 4.3. Frontend — nạp bundle

| Patch | Anchor | Thay bằng |
|---|---|---|
| `dashboard/src/i18n.ts` | `loadLocaleBundle` với 2 nhánh import | thêm nhánh `if (locale === "vi") return (await import("./locales/vi.json")).default;` |
| | `const locale = lng.startsWith("zh") ? "zh" : "en";` (×2) | thêm `lng.startsWith("vi") ? "vi"` |
| | `const fallback: UiLocale = initial === "zh" ? "en" : "zh";` | thêm `initial === "vi" ? "en"` |
| | `supportedLngs: ["zh", "en"],` | `["zh", "en", "vi"]` |
| | `const locale: UiLocale = lng.startsWith("zh") ? "zh" : "en";` trong `languageChanged` | thêm nhánh `vi` |

### 4.4. Frontend — ba chỗ chọn ngôn ngữ thật

Cả ba patch cùng một khuôn: thêm option thứ ba và bỏ logic tự viết, dùng `normalizeUiLocale`.

| Patch | Anchor | Thay bằng |
|---|---|---|
| `dashboard/src/components/AvatarDropdown.tsx` | `import { applyGuestLocale, applyUserLocale } from "../utils/locale";` | thêm `normalizeUiLocale` |
| | `const currentLang = i18n.language?.startsWith("zh") ? "zh" : "en";` | `normalizeUiLocale(i18n.language)` |
| | mảng `options` của `Segmented` (sau `langEn`) | thêm `{ label: t("account.langVi"), value: "vi" }` |
| `dashboard/src/pages/Setup/index.tsx` | `import { storeUiLocale, type UiLocale } from "../../utils/locale";` | thêm `normalizeUiLocale` |
| | `const currentLang = …startsWith("zh") ? "zh" : "en";` | `normalizeUiLocale(i18n.language)` |
| | `const locale: UiLocale = lang.startsWith("zh") ? "zh" : "en";` | `normalizeUiLocale(lang)` |
| | `options` của `Segmented` | thêm option `vi` |
| `dashboard/src/pages/Invite/index.tsx` | import từ `"../../utils/locale"` | thêm `normalizeUiLocale` |
| | `const currentLang = …`; `const locale: UiLocale = …` | `normalizeUiLocale(...)` |
| | `options` của `Segmented` | thêm option `vi` |

Riêng `Setup` và `Invite` import từ `../../utils/locale` (re-export của `localePrefs`), còn `AvatarDropdown` import từ `../utils/locale` — giữ nguyên đường dẫn upstream dùng, chỉ thêm tên vào câu import.

### 4.5. Frontend — header `Accept-Language`

| Patch | Anchor | Thay bằng |
|---|---|---|
| `dashboard/src/api/request.ts` | `"Accept-Language": i18n.language?.startsWith("zh") ? "zh" : "en",` (2 chỗ: `buildHeaders` + nhánh agent-scoped) | `"Accept-Language": normalizeUiLocale(i18n.language),` |
| `dashboard/src/api/modules/decision.ts` | cùng chuỗi, trong `streamLayaInstall` | như trên |

### 4.6. Frontend — antd và dayjs

| Patch | Anchor | Thay bằng |
|---|---|---|
| `dashboard/src/App.tsx` | `const isZh = i18n.language?.toLowerCase().startsWith("zh") ?? false;`<br>`const antdLocale = isZh ? zhCN : enUS;`<br>`dayjs.locale(isZh ? "zh-cn" : "en");` | tính `uiLocale` qua `normalizeUiLocale`, map sang `viVN` / `vi`, và import `antd/locale/vi_VN` + `dayjs/locale/vi` |

Không có patch này thì chọn tiếng Việt sẽ ra chuỗi tiếng Việt của Octop nhưng DatePicker vẫn hiện "January", Pagination vẫn "Previous/Next", Popconfirm vẫn "OK/Cancel".

### 4.7. Nhãn cho option mới

| Patch | Anchor | Thay bằng |
|---|---|---|
| `dashboard/src/locales/en.json` | `"langEn": "English",` | thêm `"langVi": "Tiếng Việt",` |
| `dashboard/src/locales/zh.json` | `"langEn": "English",` (nguyên văn — upstream để tiếng Anh trong cả hai file) | thêm `"langVi": "越南语",` |

### 4.8. File mới

| File | Nội dung |
|---|---|
| `src/dashboard/src/locales/vi.json` | 6687 leaf key, khớp key 1:1 với `en.json` |
| `src/src/octop/i18n/vi.json` | 834 leaf key, khớp key 1:1 với `en.json` backend |

Dịch từ `zh.json`, đối chiếu `en.json` để giữ đúng cấu trúc key. Không có chuỗi CJK sót lại.

### 4.9. Patch `agency` — Phòng ban

Menu cấp 1 "Phòng ban" cạnh Experts, quản lý tập agent theo bộ phận. Danh mục toàn cục, mọi user đã đăng nhập đều tạo/sửa/xóa được — **không** có permission key, nên `pathPermissionKeys("/agencies")` trả `null` và route không bị `RequirePermission` bọc.

| Patch | Anchor | Thay bằng |
|---|---|---|
| `dashboard/src/layouts/sidebarNav.tsx` | import `GraduationCap`; `SIDEBAR_NAV_KEYS` sau `"chat"`; block `navAllowed(user, "experts")` | thêm `Building2`, thêm key `"agencies"` ngay sau `"chat"`, push item `/agencies` **trước** block experts (gate `if (user)`, không theo quyền) |
| `dashboard/src/layouts/sidebarNavLayout.test.ts` | mảng `ungrouped` mặc định | thêm `"agencies"` sau `"chat"` (test khẳng định cứng thứ tự nav) |
| `dashboard/src/routes/index.tsx` | `const ExpertsPage = lazy(...)`; `pathToKey`; `{ path: "/experts", … }` | thêm `AgenciesPage` lazy + `/agencies` và `/agencies/:agencyId` + `pathToKey["/agencies"]` + nhánh `resolveSelectedKey` cho `/agencies/…` |
| `dashboard/src/routes/prefetch.ts` | `"/experts": …` | thêm `"/agencies": () => import("../pages/Agencies")` |
| `dashboard/src/pages/Experts/components/EditAgentDrawer.tsx` | import `ExpertColorPicker`; block `Form.Item` màu sắc | thêm import `AgentAgencyPicker`, chèn `<AgentAgencyPicker agentId={agent.agent_id} />` ngay dưới khối màu — patch chỉ 2 dòng, phần thân nằm ở file mới |
| `dashboard/src/locales/en.json`, `zh.json` | trước `"experts": {` ở gốc; sau `nav.experts` | thêm `nav.agencies` + nhóm `agencies.*` (37 dòng mỗi file) |
| `src/octop/api/app.py` | khối `from octop.api.routers import (...)`; danh sách `_RouterMount` | thêm `agencies` vào import, thêm `_RouterMount(agencies.router, "/api/agencies", ["agencies"])` |
| `src/octop/infra/server.py` | import `run_migrations`; hai chỗ gọi `run_migrations(db)` | import + gọi `run_overlay_migrations(db)` ngay sau, ở cả `start()` và `bind_control_plane()` |
| `src/octop/infra/users/preferences.py` | frozenset `SIDEBAR_NAV_KEYS` | thêm `"agencies"` sau `"experts"` (validate sidebar nav; frozenset nên thứ tự ở đây không ảnh hưởng UI) |

`dashboard/src/layouts/sidebarNav.test.ts` **không** cần sửa: test so tập key với chính hằng `SIDEBAR_NAV_KEYS`, nên thêm key vào mảng là đủ. Nhưng `dashboard/src/layouts/sidebarNavLayout.test.ts` có sửa: nó khẳng định cứng danh sách `ungrouped` mặc định (`chat, experts, tasks, token-usage`), nên patch thêm `"agencies"` ngay sau `"chat"`.

**Migration overlay.** Upstream đã có `src/octop/infra/db/migrations/` + `run_migrations()` chạy lúc boot, đánh dấu bằng `_schema_version`. Lớp overlay không dùng chung vì dải số `025+` thuộc về upstream — nếu overlay chen vào đó, lần nâng base lên 025 sẽ làm `_discover()` ném `Duplicate migration version 025` và container chết lúc khởi động. Vì vậy:

| File | Vai trò |
|---|---|
| `src/src/octop/overlay/migrate.py` | `run_overlay_migrations(db)` — quét `overlay/migrations/`, bỏ qua version ≤ ledger, áp xong mới ghi ledger |
| `src/src/octop/overlay/migrations/001_agency.sql` / `.pg.sql` | DDL `agency` + `agency_member` (bản pg dùng `BIGINT GENERATED BY DEFAULT AS IDENTITY`) |
| ledger `_overlay_schema_version` | một dòng `version`, tạo nếu chưa có, seed 0 |

SQL vẫn viết `IF NOT EXISTS` để tự lành nếu ledger lệch DB. Runner không import gì từ `octop.infra.db.migrate` nên hai lớp tiến hoá độc lập.

8 endpoint, tất cả chỉ `Depends(current_user)`:

| Method | Path |
|---|---|
| GET / POST | `/api/agencies` |
| GET / PUT | `/api/agencies/by-agent/{agent_id}` |
| GET / PATCH / DELETE | `/api/agencies/{agency_id}` |
| PUT | `/api/agencies/{agency_id}/members` |

Hai route `by-agent/*` khai báo **trước** `/{agency_id}` — nếu không FastAPI sẽ khớp `by-agent` thành id. Có self-check cho đúng thứ tự này (§6.5).

Gán agent hai chiều đều là **thay thế toàn bộ** (PUT): một request, không có trạng thái nửa vời, và cả trang phòng ban lẫn drawer agent cùng thao tác trên một tập. `agent_ids`/`agency_ids` lạ bị bỏ qua chứ không 400 — agent có thể vừa bị xóa ở tab khác.

Xóa phòng ban chỉ cắt liên kết; `agency_member` cascade, agent còn nguyên.

### 4.10. File mới của `agency`

| File | Vai trò |
|---|---|
| `src/src/octop/overlay/migrate.py`, `__init__.py` | runner + ledger overlay |
| `src/src/octop/overlay/migrations/001_agency.sql`, `.pg.sql` | DDL hai dialect |
| `src/src/octop/api/routers/agencies.py` | router 8 endpoint |
| `src/dashboard/src/api/modules/agency.ts`, `agency.test.ts` | client + test |
| `src/dashboard/src/pages/Agencies/index.tsx`, `index.module.less` | trang danh sách + chi tiết (một component, đọc `agencyId` từ URL) |
| `src/dashboard/src/pages/Agencies/components/AgencyCard.tsx` | card: màu, tên, mô tả, số agent/kênh, sửa/xóa |
| `…/AgencyFormModal.tsx` | modal tạo/sửa, dùng lại `ExpertColorPicker` |
| `…/AgencyAgentList.tsx` | cột trái: agent trong phòng ban + thêm/gỡ |
| `…/AgencyChannelList.tsx` | cột phải: kênh suy ra, read-only |
| `…/AgentAgencyPicker.tsx` | picker gắn vào drawer agent |

### 4.12. Patch `org-chart` — Sơ đồ tổ chức

Trang `/org-chart` vẽ toàn bộ tổ chức bằng `@xyflow/react` (cùng thư viện Orchester dùng): Tổ chức → Phòng ban → Expert, kèm edge host team → member và badge kênh. Dữ liệu lấy từ **một** endpoint.

| Patch | Anchor | Thay bằng |
|---|---|---|
| `dashboard/package.json` | khối `dependencies` | thêm `"@xyflow/react": "^12.12.0"` |
| `dashboard/package-lock.json` | — | lock sinh bằng `npm install --save @xyflow/react@12.12.0 --package-lock-only`, không viết tay |
| `dashboard/src/layouts/sidebarNav.tsx` | `import { Building2 }`; `SIDEBAR_NAV_KEYS`; block agencies | thêm `Network`, key `"org-chart"`, push item `/org-chart` sau block agencies (gate `if (user)`) |
| `dashboard/src/layouts/sidebarNavLayout.test.ts` | mảng `ungrouped` | thêm `"org-chart"` sau `"agencies"` |
| `dashboard/src/routes/index.tsx` | `const AgenciesPage = lazy(...)`; `pathToKey`; route `/agencies` | thêm `OrgChartPage` lazy + `{ path: "/org-chart" }` + `pathToKey["/org-chart"]` |
| `dashboard/src/routes/prefetch.ts` | `"/agencies": …` | thêm `"/org-chart": () => import("../pages/OrgChart")` |
| `dashboard/src/pages/Experts/index.tsx` | `const handleEditSaved = useCallback(` | thêm một `useEffect` đọc `?agent=` → `setEditAgent` (deep link từ sơ đồ) |
| `dashboard/src/locales/en.json`, `zh.json` | sau `nav.agencies`; sau `"agencies": {` | thêm `nav.orgChart` + nhóm `org.*` (23 leaf key) |
| `src/octop/api/app.py` | khối import routers; danh sách `_RouterMount` | thêm `orgchart` + `_RouterMount(orgchart.router, "/api", ["org-chart"])` |
| `src/octop/infra/users/preferences.py` | frozenset `SIDEBAR_NAV_KEYS` | thêm `"org-chart"` sau `"agencies"` |

Hai file `package.json`/`package-lock.json` nằm ở **`patches/dashboard-pkg/`**, không phải `patches/dashboard/`: chúng phải áp **trước** `npm ci`, còn 9 patch còn lại áp sau khi copy source. Xem §5. Các patch ở đây có đường dẫn relative với gốc `octop/` (`dashboard/package-lock.json`), nên Dockerfile `cd /build` trước khi áp — không đứng ở `WORKDIR /build/dashboard`.

**`GET /api/org-graph`** trả `{nodes, edges, summary}` trong một lượt. Node id có tiền tố để frontend route click mà không cần tra thêm: `root:org`, `agency:<agency_id>`, `agent:<agent_id>`, và node tổng hợp `agency:__unassigned__`.

Ba điểm quyết định hành vi:

- **Tập agent hiển thị** dùng đúng hai lời gọi của `GET /api/agents?scope=mine` — `registry.list_agents(user.id)` + `agent_repo.list_shared(...)`. Không viết lại rule phân quyền.
- **Edge host team → member** lấy từ `TeamService.visible_member_ids(host_id)`, không phải SQL: roster của team nằm trong `.octop/manifest.json`. Edge chỉ vẽ khi **cả hai** đầu nằm trong tập hiển thị, nên member bị chia sẻ ngoài quyền người xem không lộ tên.
- **Agency 0 agent bị ẩn**; agent không thuộc agency nào gom vào node "Chưa phân ban". Một agent thuộc nhiều agency chỉ vẽ một lần (agency đứng trước theo tên giữ nó) — node trùng id sẽ làm ReactFlow vỡ.

| File mới | Vai trò |
|---|---|
| `src/src/octop/api/routers/orgchart.py` | endpoint `GET /org-graph` |
| `src/dashboard/src/api/modules/orgChart.ts` | type + `getOrgGraph()` |
| `src/dashboard/src/pages/OrgChart/index.tsx` | trang: canvas, search, reset layout, poll 15s, click điều hướng |
| `src/dashboard/src/pages/OrgChart/index.module.less` | style node + khung canvas |
| `src/dashboard/src/pages/OrgChart/layout.ts` | hàm thuần `layoutNodes` (xếp agency thành hàng ≤ 2400px) |
| `src/dashboard/src/pages/OrgChart/layout.test.ts` | test layout, không cần DOM |
| `src/dashboard/src/pages/OrgChart/components/nodes.tsx` | `RootNode` / `AgencyNode` / `AgentNode` |
| `scripts/orgchart_route_selfcheck.py` | AST: đúng 1 route `GET /org-graph`, không có route path-param ở gốc `/api` |
| `scripts/orgchart_api_smoke.py` | smoke HTTP: tạo agency + gán agent → graph có node + edge, xoá → mất, dọn sạch |

Vị trí node người dùng kéo lưu ở `localStorage` key `octop:org:positions`, ghi debounce 250ms; "Xếp lại" xoá key và dựng lại theo layout mặc định.

### 4.11. Patch `en-default` — cài mới mặc định tiếng Anh

Docker entrypoint bootstrap admin bằng `octop init`; `octop init` gọi `UserRepo.create()` mà mặc định của repo là `locale="zh"`. Kết quả: DB mới tinh sinh ra admin `zh`, dashboard đăng nhập xong gọi `applyUserLocale(me.locale)` nên **toàn bộ UI lật sang tiếng Trung** dù trình duyệt là tiếng Anh.

| Patch | Anchor | Thay bằng |
|---|---|---|
| `src/octop/cli/commands/init.py` | `user_repo.create(...)` trong nhánh tạo admin — kết thúc bằng `display_name=display_name,` | thêm `locale="en",` (kèm comment) |

Chỉ một chỗ, và chỉ đúng chỗ gây lỗi:

- `DEFAULT_LOCALE = "zh"` trong `infra/utils/locale.py` **giữ nguyên** — nó là default của các đường không có user (message của channel, thông báo lỗi trước khi đăng nhập, subagent catalog). Đổi nó sẽ lật cả những surface chưa có người dùng chọn ngôn ngữ.
- `detectBrowserLocale()` bên frontend **đã** trả `"en"` khi trình duyệt không phải `zh`, nên guest (trang login, setup wizard) vốn đã mở tiếng Anh với trình duyệt tiếng Anh. Không cần đụng.

Hệ quả: admin tạo bởi `octop init` mở dashboard lần đầu bằng tiếng Anh và vẫn chuyển ngôn ngữ được ở `AvatarDropdown`. Ai muốn mặc định khác chỉ cần sửa một dòng trong patch.

### 4.13. Patch `webhook` — Webhook sự kiện agent

Đẩy **mọi** trajectory event của agent ra URL bên ngoài dưới dạng HTTP POST có ký HMAC-SHA256, có outbox + retry + nhật ký giao nhận. Chi tiết đầy đủ: [`docs/03-WEBHOOK-ARCHITECTURE.md`](docs/03-WEBHOOK-ARCHITECTURE.md).

Trang nằm trong **Settings → Cài đặt ứng dụng → tab Webhook** (`/admin/advanced?tab=webhooks`), không phải mục sidebar riêng — đây là cấu hình hạ tầng. Thêm một mục sidebar sẽ cần 4 patch nữa (`sidebarNav`, `routes`, `prefetch`, `preferences.py`) cho cùng một trang.

| Patch | Anchor | Thay bằng |
|---|---|---|
| `src/octop/api/app.py` | khối import routers; danh sách `_RouterMount` | thêm `webhooks` + `_RouterMount(webhooks.router, "/api/webhooks", ["webhooks"])` |
| `src/octop/infra/server.py` | sau `trajectory_service = TrajectoryService(...)`; `start()` + `bind_control_plane()` | khởi tạo `WebhookStore` + dispatcher, gắn `WebhookSink` qua `attach_sink()`. **Không** khởi động lazy: outbox phải drain kể cả khi không ai mở dashboard |
| `src/octop/infra/history/trajectory/service.py` | `__init__`; `_publish()`; `_upsert()`; `finish_turn()`; 5 chỗ chốt nội dung | thêm `sinks` ctor + `attach_sink()`; `_publish` nhận `phase` và gọi sink trong `suppress(Exception)`; 5 chỗ `_upsert` truyền `phase="completed"`. **Không** đổi `final` → SSE y nguyên. Patch lớn nhất bộ (9 hunk, +45/−18) vì đây là điểm chèn duy nhất vào sổ sự kiện |
| `dashboard/src/pages/Settings/AdvancedSettings/index.tsx` | union `TabKey`; mảng `TABS`; `parseTab()`; `renderTab()` switch | thêm key `"webhooks"`, item `Webhook` icon, case render |
| `dashboard/src/utils/permissions.ts` | `ADVANCED_TAB_PERMISSIONS` | `webhooks: "observability"` — **dùng lại** key có sẵn, không thêm permission mới |
| `dashboard/src/locales/en.json`, `zh.json` | sau `"observability": {` | `nav.webhooks` + nhóm `webhook.*` (65 key mỗi file = 1 nav + 64 leaf, gồm cả nhóm header tuỳ chỉnh) |

Phụ thuộc **`agency`**: overlay migration runner (`run_overlay_migrations`) do patch `agency` cài; `002_webhook` chỉ thêm file vào folder đó. Manifest ghi `depends_on: [agency]`.

| File mới | Vai trò |
|---|---|
| `src/src/octop/api/routers/webhooks.py` | router 8 endpoint: CRUD + rotate secret + test + deliveries + retry |
| `src/src/octop/overlay/webhook/store.py` | outbox: enqueue idempotent, claim, backoff, stale recovery, seal secret/header |
| `src/src/octop/overlay/webhook/dispatcher.py` | vòng gửi: `validate_url` (SSRF guard + `OCTOP_WEBHOOK_ALLOW_HOSTS`), POST, phân loại lỗi |
| `src/src/octop/overlay/webhook/signing.py` | `sign()`, `build_envelope()`, `event_type()`, `matches()` — thuần, test được |
| `src/src/octop/overlay/webhook/__init__.py` | export `WebhookSink`, `WebhookDispatcher`, `WebhookStore` |
| `src/src/octop/overlay/migrations/002_webhook.sql` / `.pg.sql` | `webhook_endpoint` + `webhook_delivery` |
| `src/dashboard/src/api/modules/webhooks.ts` | type + `webhooksApi` 8 method + `WEBHOOK_EVENT_TYPES` cho picker |
| `src/dashboard/src/pages/Settings/Webhooks/index.tsx` | trang: bảng endpoint, modal tạo/sửa, header rows, panel deliveries |
| `src/dashboard/src/pages/Settings/Webhooks/index.module.less` | style bảng + panel |
| `scripts/webhook_selfcheck.py` | 8 nhóm kiểm tra hàm thuần + outbox trên SQLite tạm |
| `scripts/webhook_live_test.py` | e2e trong image: chat thật → 11 loại event tới máy nhận loopback |
| `scripts/webhook_e2e.py` | phủ thêm event cần MCP server / thread bị nén |
| `scripts/webhook_receiver.py` | máy nhận trên host: in + ghi JSONL, kiểm HMAC, `--expect` kiểm custom header mà không ghi token ra đĩa |
| `scripts/seed_provider.py` | seed provider để chạy được agent trong môi trường trống |

Ba điểm quyết định hành vi:

- **Không xây lại sổ sự kiện.** `trajectory_events` đã là append-only với `event_id` ổn định + `seq` đơn điệu. Phần thêm thuần tuý là lớp vận chuyển ra ngoài.
- **`body_json` đóng băng lúc xếp hàng.** Sửa bộ lọc của endpoint về sau không làm đổi payload đã enqueue. `UNIQUE (endpoint_id, event_id, type)` là toàn bộ idempotency — `INSERT OR IGNORE`, không cần kiểm tra trước.
- **Secret và custom header không nằm trong bảng.** Lưu ở `SecretRepo` (`webhook_secret:<id>`, `webhook_headers:<id>`), Fernet-sealed qua `PURPOSE_SETTINGS`. API chỉ trả `secret_set: true` và `header_names: [...]` — giá trị không bao giờ rời server.

### 4.14. Patch `workflow-ui` — Flows (luồng tự động)

Trang `/flows` (danh sách + thêm flow từ mẫu) và `/flows/:flowId` (builder: toolbar, palette, canvas `@xyflow/react`, inspector). Port từ Flows của Orchester; dữ liệu hiện lưu giả trong `localStorage` qua `flowApi` (chưa có backend/engine). **Catalog node rỗng — mỗi node được thêm trọn gói, từng cái một.** Thiết kế: [`docs/04-FLOWS-ARCHITECTURE.md`](docs/04-FLOWS-ARCHITECTURE.md); **trạng thái hiện tại, cách thêm node, lệnh và bẫy đã gặp: [`docs/05-FLOWS-NODE-GUIDE.md`](docs/05-FLOWS-NODE-GUIDE.md).**

| File upstream | Anchor | Thay bằng |
|---|---|---|
| `dashboard/src/layouts/sidebarNav.tsx` | `import { …, Network }`; `SIDEBAR_NAV_KEYS`; block org-chart | thêm `Workflow`, key `"flows"`, push item `/flows` sau org-chart (gate `if (user)`) |
| `dashboard/src/layouts/sidebarNavLayout.test.ts` | mảng `ungrouped` | thêm `"flows"` sau `"org-chart"` |
| `dashboard/src/routes/index.tsx` | `OrgChartPage` lazy; `pathToKey`; route `/org-chart` | thêm `FlowsPage` lazy, `pathToKey["/flows"]`, route `/flows` và `/flows/:flowId` |
| `dashboard/src/routes/prefetch.ts` | `"/org-chart": …` | thêm `"/flows": () => import("../pages/Flows")` |
| `dashboard/src/locales/{en,zh}.json` | `nav.orgChart`; nhóm `org`; trước `experts` | thêm `nav.flows` + nhóm `flows` (sinh bằng `scripts/regen_flows_locale_patches.py`) |
| `src/octop/infra/users/preferences.py` | frozenset `SIDEBAR_NAV_KEYS` | thêm `"flows"` sau `"org-chart"` |

Không đổi backend khác, không migration, không dependency mới.

---

## 5. Build áp patch thế nào

Hai image, build nối tiếp:

| Image | Dockerfile | Vai trò |
|---|---|---|
| `octop-base:local` | `octop/docker/Dockerfile` — **nguyên văn của upstream** | Runtime Octop dựng từ source đang checkout |
| `octop-orchester:latest` | `octop-orchester/Dockerfile` — `FROM octop-base:local` | Thêm lớp tuỳ biến |

Không image nào pull từ registry: submodule là nguồn sự thật, image publish trên GHCR có thể trễ hơn source. `octop/docker/Dockerfile` **không bị sửa hay chép lại** — submodule lên commit mới là base tự động theo, không có bước đồng bộ tay nào.

**Thứ tự build do compose lo.** `docker-compose.yml` khai báo service `octop-base` và truyền nó cho service `octop` qua `additional_contexts`:

```yaml
additional_contexts:
  "octop-base:local": service:octop-base
```

BuildKit dựng `octop-base` trước rồi đưa vào làm named context, nên `FROM ${OCTOP_BASE}` trong Dockerfile phân giải được. Cách này cũng ghim base **theo nội dung** chứ không theo tag — `octop-base:local` cũ trong máy không thể bị dùng nhầm.

`octop-base` mang `deploy.replicas: 0` để compose build image nhưng không tạo container — nếu chạy, đó sẽ là server Octop thứ hai. `docker compose up -d` một lệnh là dựng cả hai image rồi chỉ khởi động `octop`; `docker compose build` thì chỉ build.

Nếu build tay (không qua compose) thì phải dựng base trước:

```bash
docker build -f octop/docker/Dockerfile -t octop-base:local octop
docker build -f octop-orchester/Dockerfile -t octop-orchester:latest .
```

Lớp tuỳ biến nằm ở `octop-orchester/Dockerfile`, hai stage:

**Stage `frontend-builder`** (`WORKDIR /build/dashboard`) — dựng lại dashboard:

1. `COPY octop/dashboard/package.json octop/dashboard/package-lock.json ./`.
2. `cd /build` rồi áp mọi `patches/dashboard-pkg/**/*.patch` — **trước** `npm ci`. Phải `cd /build` vì đường dẫn trong patch là relative với gốc `octop/` (`dashboard/package-lock.json`), đứng ở `/build/dashboard` sẽ thành `/build/dashboard/dashboard/...` và `git apply` báo *No such file or directory*. Patch nào đụng `package.json`/`package-lock.json` phải nằm ở `patches/dashboard-pkg/`, vì `npm ci` chỉ cài đúng những gì lock khai báo tại thời điểm nó chạy. Thêm dependency mà để ở `patches/dashboard/` thì `npm ci` không thấy, build chết lúc import.
3. `npm ci` — lock lệch `package.json` là fail ngay, nên bước này chính là test cho lockfile.
4. `COPY octop/dashboard/ ./` — source upstream gốc.
5. `COPY octop-orchester/src/dashboard/ ./` — file mới đè lên (tức `dashboard/src/locales/vi.json`).
6. Áp mọi `patches/dashboard/**/*.patch` bằng `git apply --whitespace=nowarn`. Đường dẫn trong patch là relative với gốc `octop/`, nên đứng ở `/build` là khớp.
7. `npm run build:docker`.

Vì sao phải build lại dashboard chứ không patch bundle: image publish chỉ có bundle đã minify, không có source, và bundle **không** chứa antd `vi_VN` / dayjs `vi` — chỉ patch chuỗi không thể làm DatePicker/Pagination ra tiếng Việt.

**Stage runtime** (`FROM ${OCTOP_BASE}`) — thêm 2 layer:

1. `COPY octop-orchester/src/src/ /app/src/` — file mới (`src/octop/i18n/vi.json`).
2. Áp mọi `patches/src/**/*.patch` bằng `git apply` tại `/app`, đường dẫn `src/octop/...` khớp. Base cài octop dạng editable (`.pth` → `/app/src`) nên sửa file là có hiệu lực, không cần `uv sync` lại.
3. Xoá `/app/src/octop/dashboard` cũ rồi `COPY` bản build từ stage 1 — `COPY` gộp thư mục, không xoá trước thì chunk hash cũ của upstream nằm lại.

Patch áp **trước** khi chạy, không phải sửa app đang chạy. Nên muốn đổi gì trong patch cũng phải build lại image — không có đường hot-patch.

Build + chạy (một lệnh, từ sạch):

```bash
# từ octop-orchester/
docker compose up -d          # dựng octop-base → octop-orchester, chạy octop
docker compose build          # chỉ build, không chạy
```

`git apply` fail thì build fail ngay, kèm `FAILED: <đường dẫn patch>` và lý do (`patch does not apply`, `corrupt patch`…). Image cũ vẫn còn nguyên, không bị đè.

### 5.1 Dữ liệu nằm ở đâu

Hai chỗ, cả hai đều sống ngoài container:

| Container path | Kiểu mount | Chứa gì |
|---|---|---|
| `/data` | bind mount `${OCTOP_DATA:-../data}` → `<repo>/data` | `.octop/` (DB, config, agents, credential, plugins) và `.cache/` (wheel uv, browser Playwright) |
| `/app/.venv` | **named volume** `octop-orchester-venv` | toàn bộ venv Python (~1.3G nền + mọi gói cài từ UI) |

Hệ quả: cài gói trong dashboard (Settings → tuỳ chọn → cài package, chạy `uv pip install` vào `sys.executable` = `/app/.venv/bin/python`) rồi `docker compose down` / xoá hẳn container / `up -d` lại — gói vẫn còn, không phải cài lại. Wheel đã tải nằm ở `.cache/uv` trong `OCTOP_DATA` nên lần cài sau cũng không cần mạng.

`OCTOP_DATA` tương đối với `octop-orchester/`, nên mặc định `../data` là `<repo>/data` — ngay trong workspace, không nằm ở home. Folder này nằm trong `.gitignore` ở repo root: chứa DB và credential, không commit.

**Vì sao venv là volume chứ không phải folder host.** Docker **seed** volume từ đường dẫn tương ứng trong image ngay lần tạo đầu, nên volume khởi đầu đã có sẵn 56k file / 1.3G của image. Bind mount một folder host rỗng thì ngược lại: folder rỗng **che** mất venv trong image, container không có `python`, và phải `uv sync` lại từ đầu (chậm, cần mạng, và trên Windows bind mount 56k file nhỏ còn chậm hơn nữa). Đổi lại, volume **không** đọc được bằng Explorer — muốn xem/sửa thì qua `docker run --rm -v octop-orchester-venv:/v ...`.

**Venv cũ sau khi rebuild image.** Volume không tự cập nhật, nên một image mới (base mới, `uv.lock` mới) sẽ gặp venv cũ. Image ghi hash của `uv.lock` + `pyproject.toml` vào `/app/.venv/.image-stamp` lúc build; `docker/octop-entrypoint.sh` so hash đó lúc boot và chỉ chạy `uv sync --frozen --no-dev --inexact` khi lệch. `--inexact` để gói cài từ UI không bị dọn. Boot bình thường (stamp khớp) không tốn gì và không cần mạng; sync thất bại (offline) thì vẫn khởi động, chỉ cảnh báo.

Reset baseline venv (giữ dữ liệu `/data`):

```bash
docker compose down
docker volume rm octop-orchester-venv
docker compose up -d      # tạo volume mới, seed lại từ image hiện tại
```

Reset tất cả — xem §6 mục 7.

---

## 6. Verify sau khi build

Chín mức, từ nhanh tới đầy đủ. Lệnh `docker compose` chạy từ `octop-orchester/`; lệnh `python` chạy từ repo root.

**1. Patch có áp không** — build log phải có 49 dòng `applying` (13 `vi-i18n` + 10 `agency` + 1 `en-default` + 11 `org-chart` + 7 `webhook` + 7 `workflow-ui`) và không có `FAILED`:

```bash
# từ octop-orchester/
docker compose build --no-cache --progress=plain 2>&1 | grep -E "applying|FAILED:"
```

**2. Bundle có tiếng Việt không:**

```bash
docker exec octop-orchester sh -c '
  ls src/octop/dashboard/assets/vi.*.js
  grep -c langVi src/octop/dashboard/assets/{en,zh,vi}.*.js
  grep -c vi_VN src/octop/dashboard/assets/vendor-antd.*.js
  grep -o "value:\"vi\"" src/octop/dashboard/assets/index.*.js | wc -l
'
```

Kỳ vọng: một file `vi.<hash>.js`; `1` cho mỗi locale chunk; `1` (hoặc hơn) cho vendor antd; `3` cho số option "vi" (account menu + setup + invite).

**3. Backend nhận `vi`:**

```bash
curl -s -H 'Accept-Language: vi' http://localhost:9088/api/i18n/tools | head -c 200
```

Cổng lấy theo `OCTOP_PORT` trong `.env` (mặc định của image là 8088). Phải trả `"locale":"vi"` và label tiếng Việt. Chạy lại với `en` và `zh` để chắc không hỏng hai locale cũ.

**4. Smoke UI** — mở dashboard, menu tài khoản → chọn "Tiếng Việt", reload. Ngôn ngữ phải giữ nguyên (`octop:ui-locale` trong localStorage), `document.documentElement.lang` = `vi-VN`, DatePicker hiện "Tháng".

Kiểm tra parity bản dịch (chạy ngoài container, cần Python):

```bash
python octop-orchester/scripts/vi-i18n/check_parity.py
```

```
octop-orchester/src/dashboard/src/locales/vi.json: 6687 leaves | missing 0 | extra 0 | OK
octop-orchester/src/src/octop/i18n/vi.json: 834 leaves | missing 0 | extra 0 | OK
```

Kỳ vọng `missing 0 | extra 0` ở cả hai. Script so với `en.json` **upstream** (chưa patch) và bỏ qua `account.langVi` — key do patch tự thêm. Chạy script này ngay sau khi upgrade Octop là cách nhanh nhất để biết bản dịch có lệch không.

Muốn biết **có key mới cần dịch** chứ không chỉ biết bản dịch đã ghi ra có khớp, dùng `sync_batches.py` — xem §7.2.

**5. Migration overlay + Phòng ban:**

```bash
# ledger phải là 1, hai bảng phải tồn tại
docker exec octop-orchester python -c "
import sqlite3
c = sqlite3.connect('/data/.octop/octop.db')
print(c.execute('SELECT version FROM _overlay_schema_version').fetchall())
print(sorted(r[0] for r in c.execute(
    \"SELECT name FROM sqlite_master WHERE name LIKE 'agency%'\")))"

# khởi động lại, ledger phải vẫn là 1 (không áp lại)
docker compose restart octop
```

Kỳ vọng `[(1,)]` và `['agency', 'agency_member']`, giữ nguyên sau restart. Hai script kiểm nhanh chạy được ngoài Docker, không cần DB thật:

```bash
python octop-orchester/scripts/overlay_selfcheck.py
# OK: idempotent, agency+agency_member created, delete cascades

python octop-orchester/scripts/agencies_route_selfcheck.py
# OK: 8 routes, by-agent declared before /{agency_id}
```

Smoke API (lấy token trước, `$T`):

```bash
curl -sH "Authorization: Bearer $T" localhost:9088/api/agencies                      # []
curl -s -XPOST -H "Authorization: Bearer $T" -H 'content-type: application/json' \
     -d '{"name":"Kỹ thuật"}' localhost:9088/api/agencies
curl -s -XPUT -H "Authorization: Bearer $T" -H 'content-type: application/json' \
     -d '{"agent_ids":["<agent_id>"]}' localhost:9088/api/agencies/<agency_id>/members
curl -sH "Authorization: Bearer $T" localhost:9088/api/agencies/by-agent/<agent_id>
curl -s -XDELETE -H "Authorization: Bearer $T" localhost:9088/api/agencies/<agency_id>
```

Smoke UI: menu **Phòng ban** hiện với user thường (không phải admin) → tạo → thêm agent → thấy kênh suy ra → gỡ agent → xóa phòng ban → agent vẫn còn. Mở drawer sửa agent: khối "Phòng ban" phải hiện đúng tập vừa gán ở trang phòng ban — hai chỗ đọc chung một nguồn.

**6. Unit test dashboard (trên overlay đã áp patch):**

Chạy trong Docker vì `octop/dashboard/node_modules` không có sẵn ở máy:

```bash
bash octop-orchester/scripts/dashboard_test.sh \
  src/layouts/sidebarNav.test.ts src/layouts/sidebarNavLayout.test.ts \
  src/api/modules/agency.test.ts
# Test Files  1 failed | 2 passed (3)
# Tests  1 failed | 11 passed (12)
```

Test fail duy nhất là `sidebarNavLayout.test.ts > omits nav items and built-in groups the user cannot access`. Đã đo trên cây upstream sạch (`git checkout -- .`, không áp patch nào) bằng đúng lệnh trên: cùng fail, cùng thông báo `expected [ 'c_aabbccdd' ] to deeply equal [ 'settings', 'c_aabbccdd' ]`, 1 failed / 6 passed. Vậy đây là lỗi có sẵn của upstream `890111b7`, overlay không thêm test fail nào.

Không truyền tham số thì chạy toàn bộ. Upstream commit `890111b7` đã có sẵn 8 test file fail (ChatInput.prefill, AuthGuard, skillMarkdown…) — overlay không làm tăng con số đó.

**7. Cài mới mở tiếng Anh:**

```bash
# Dọn sạch state cũ rồi dựng lại từ đầu
# `-v` xoá volume octop-orchester-venv; rm xoá dữ liệu /data trên host
docker compose down -v
rm -rf "${OCTOP_DATA:-../data}"
docker compose up -d

# Admin vừa tạo phải mang locale 'en', không phải 'zh'
docker exec octop-orchester python -c "
import sqlite3
c = sqlite3.connect('/data/.octop/octop.db')
print(c.execute('SELECT username, locale FROM users').fetchall())"
```

Kỳ vọng `[('admin', 'en')]`. Mở dashboard bằng trình duyệt chưa có `localStorage.octop:ui-locale` (profile mới / ẩn danh): giao diện phải là tiếng Anh ngay sau khi đăng nhập, không nháy sang tiếng Trung. Sau đó bấm đổi sang Tiếng Trung được và phải giữ nguyên sau reload.

Nếu DB đã tồn tại từ trước, patch này **không** sửa admin cũ — `octop init` thấy user đã có thì bỏ qua. Muốn đổi user cũ: menu tài khoản, hoặc `octop user ...` trong container.

Phạm vi: chỉ admin đầu tiên do `octop init` tạo. User tạo sau đó (admin thêm qua API `/api/users`, hay `octop user add`) vẫn nhận `locale` theo default của `normalize_locale` — tức `zh`, và họ tự đổi được ở menu tài khoản. Nếu muốn cả những user đó mở bằng tiếng Anh thì đó là thay đổi ở `UserRepo.create` / `UserManager.create`, không phải `init.py`.

**8. Sơ đồ tổ chức:**

```bash
python octop-orchester/scripts/orgchart_route_selfcheck.py   # AST: đúng 1 route
python octop-orchester/scripts/orgchart_api_smoke.py         # HTTP: node + edge có mặt rồi biến mất
```

Build phải pass bước `npm ci` với `@xyflow/react` trong lock — nếu lock lệch `package.json`, `npm ci` fail và build dừng ở đó, không cần kiểm riêng. Bundle thật sự chứa trang sơ đồ:

```bash
docker exec octop-orchester sh -c '
  grep -rl "octop:org:positions" /app/src/octop/dashboard/assets/*.js
  grep -rl "org-graph"            /app/src/octop/dashboard/assets/*.js'
```

Kỳ vọng mỗi lệnh in ra đúng một chunk `index.<hash>.js`. Đừng kiểm bằng `ls | grep -i flow`: upstream đã có sẵn `flowDiagram-<hash>.js` nên lệnh đó pass kể cả khi patch org-chart không áp.

UI: mở `/org-chart` — cây Tổ chức → Phòng ban → Expert; agent chưa vào phòng ban nằm ở "Chưa phân ban"; kéo một node rồi reload phải giữ vị trí; "Xếp lại" trả về mặc định; click expert mở drawer, click phòng ban sang `/agencies/<id>`. Edge host team → member vẽ nét đứt có nhãn tên team.

**9. Gói cài từ UI còn sau khi xoá container:**

```bash
# cài thử đúng đường mà UI dùng (sys.executable = /app/.venv/bin/python)
docker exec octop-orchester uv pip install --python /app/.venv/bin/python six==1.16.0

# xoá hẳn container rồi dựng lại
docker compose down
docker compose up -d
docker exec octop-orchester python -c "import six; print('six', six.__version__)"
```

Kỳ vọng `six 1.16.0`. Kiểm tra cả hai mount:

```bash
docker inspect octop-orchester --format '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
# bind   D:\Sources\RandD\octop-orgchester\data -> /data
# volume octop-orchester-venv/_data         -> /app/.venv
```

Gỡ gói thử: `docker exec octop-orchester uv pip uninstall --python /app/.venv/bin/python six`.

---

## 7. `scripts/vi-i18n/` là gì

Đây là **pipeline dịch**, không phải một phần của build. Image không copy folder này. Nó tồn tại để lần sau cần cập nhật bản dịch thì có chỗ làm việc, thay vì sửa tay file 6687 key.

```
scripts/vi-i18n/
├── sync_batches.py    ← phát hiện key mới upstream, chẻ batch chờ dịch
├── merge.py           ← gộp batch thành vi.json (ghi vào ../src/)
├── check_parity.py    ← so leaf key vi.json với en.json upstream
├── dashboard/     batch_01..13.json   ← nguồn tiếng Anh/Trung, chia theo nhóm key
├── dashboard_vi/  batch_01..13.json   ← bản dịch tiếng Việt tương ứng
├── backend/       batch_01..03.json
└── backend_vi/    batch_01..03.json
```

`dashboard/batch_08.json` và `dashboard_vi/batch_08.json` đã được sửa tay để có khoá `account.langVi` (nguồn tiếng Anh/Trung và bản dịch). Batch là nguồn — không phải `src/.../vi.json`.

### 7.1. Ba script, ba việc khác nhau

| Script | Đọc | Ghi | Khi nào chạy |
|---|---|---|---|
| `sync_batches.py` | `octop/**/en.json`, `zh.json` + các batch | `dashboard/batch_NN.json` + `dashboard_vi/batch_NN.json` (chỉ khi có `--write`) | **Ngay sau khi pull octop mới** |
| `merge.py` | `*_vi/batch_*.json` | `octop-orchester/src/.../vi.json` | Sau khi dịch xong |
| `check_parity.py` | `vi.json` vs `en.json` upstream | không ghi gì | Sau `merge.py`, để xác nhận |

Không script nào tự dịch. `sync_batches.py` chỉ **phát hiện key mới và tạo batch rỗng chờ dịch** — phần dịch vẫn là việc của người (hoặc của một lượt dịch riêng).

### 7.2. Quy trình đầy đủ khi cập nhật Octop

```bash
# 0. Lấy code mới
cd octop && git fetch && git checkout <commit-mới> && cd ..

# 1. Kiểm tra bản dịch có lệch không — chỉ báo, không ghi
python octop-orchester/scripts/vi-i18n/sync_batches.py
```

Kết quả khớp thì dừng ở đây:

```
dashboard: upstream 6628 leaves | batch 6629 | missing 0 | extra 0
backend: upstream 834 leaves | batch 834 | missing 0 | extra 0
```

Có key mới thì exit 1 và liệt kê:

```
dashboard: upstream 6643 leaves | batch 6629 | missing 15 | extra 1
  missing: app.newFeatureTitle
  missing: settings.newGroup.label
  extra:   app.removedKey
```

```bash
# 2. Chẻ key mới thành batch chờ dịch
python octop-orchester/scripts/vi-i18n/sync_batches.py --write
#   wrote batch_14.json (15 keys) to dashboard/ and dashboard_vi/ — translate dashboard_vi/batch_14.json

# 3. Dịch dashboard_vi/batch_14.json (và backend_vi/batch_NN.json nếu có)
#    File nguồn dashboard/batch_14.json đang giữ nguyên tiếng Trung làm đối chiếu.
#    Dịch dở thì đổi tên thành batch_14_partial.json — merge.py bỏ qua file này.

# 4. Gộp và kiểm tra
python octop-orchester/scripts/vi-i18n/merge.py
python octop-orchester/scripts/vi-i18n/check_parity.py

# 5. Build lại image
cd octop-orchester && docker compose up -d
```

**`extra` thì xử lý tay.** Key upstream đã xoá mà batch còn giữ — `sync_batches.py` chỉ báo, không tự xoá, vì xoá nhầm một nhóm còn dùng thì mất bản dịch. Mở batch tương ứng, xoá key, chạy lại `merge.py`.

### 7.3. Những gì script tự lo

- **`merge.py` gộp sâu theo từng nhóm**, không ghi đè cả nhóm. Batch mới chỉ có `app.zzNew` thì `app.pageTitle` của batch cũ vẫn còn — trước đây gộp nông sẽ làm mất cả nhóm `app`. Trùng key thật thì cảnh báo, batch sau thắng.
- **`merge.py` cảnh báo batch chưa dịch**: file trong `*_vi/` giống byte-for-byte file nguồn trong `<kind>/` → đó là placeholder từ `sync_batches.py`, chưa ai dịch.
- **`sync_batches.py` tự đánh số batch kế tiếp** (`batch_NN.json`), không cần sửa danh sách ở đâu cả — `merge.py` đọc mọi `batch_*.json` theo thứ tự tên.
- **Batch mới được seed bằng tiếng Trung** (`zh.json`), không phải tiếng Anh, vì batch gốc cũng là tiếng Trung — người dịch nhìn hai file cạnh nhau là thấy ngay chỗ chưa làm.
- **`account.langVi`** (key do patch tự thêm, không có upstream) được `check_parity.py` bỏ qua qua hằng `PATCH_ADDED`, nên không bị báo `extra` sai.

### 7.4. Khi nào phải sửa tay

| Tình huống | Việc phải làm |
|---|---|
| Upstream đổi **nội dung** một chuỗi đã dịch (không đổi key) | Không script nào phát hiện — key vẫn khớp, bản dịch cũ vẫn nằm đó. Đọc diff của `en.json` khi upgrade để biết chuỗi nào đổi nghĩa |
| Upstream xoá key | `sync_batches.py` báo `extra`, xoá tay trong batch (§7.2) |
| Upstream tách/gộp nhóm key | Key lá đổi đường dẫn → hiện thành cặp `missing` + `extra`, xử lý như hai trường hợp trên |
| Muốn thêm locale khác nữa | `KINDS` trong `sync_batches.py` và `TARGETS` trong `merge.py` đang gắn cứng `dashboard`/`backend` |

---

## 8. Khi upgrade Octop

Nâng submodule `octop/` lên commit mới rồi build. Nếu patch còn khớp, xong. Nếu không, `git apply` báo lỗi và nêu đường dẫn.

Trình tự đầy đủ khi upgrade:

```bash
# 0. Đang đứng ở đâu? Patch nào đã lỗi thời?
python octop-orchester/scripts/patch_status.py

# 1. Lấy code mới
cd octop && git fetch && git checkout <commit-mới> && cd ..

# 2. Kiểm tra lại — script nêu đúng file upstream đã đổi và patch cần xem
python octop-orchester/scripts/patch_status.py
python octop-orchester/scripts/patch_status.py --apply-check
python octop-orchester/scripts/patch_status.py --collisions

# 3. Bản dịch có key mới không?
python octop-orchester/scripts/vi-i18n/sync_batches.py

# 4. Nếu có -> chẻ batch, dịch, merge, rồi build (chi tiết §7.2)
python octop-orchester/scripts/vi-i18n/sync_batches.py --write
#    ... dịch <kind>_vi/batch_NN.json ...
python octop-orchester/scripts/vi-i18n/merge.py
python octop-orchester/scripts/vi-i18n/check_parity.py

# 5. Rebase patch hỏng (§8.1-8.3), rồi khoá base mới
python octop-orchester/scripts/patch_status.py --apply-check   # phải sạch
python octop-orchester/scripts/patch_status.py --record
python octop-orchester/scripts/patch_status.py --report
cd octop-orchester && docker compose up -d
```

`patch_status.py` là công cụ chính của bước này — xem [`docs/00-PATCH-REGISTRY.md`](docs/00-PATCH-REGISTRY.md) để biết nó kiểm gì và đưa gì cho agent khi rebase. Bước 2 chạy được **trước** khi build: nó chỉ đọc file và chạy `git apply --check` trong thư mục tạm.

Bước 2 chạy được **trước** khi build — nó chỉ đọc `octop/**/en.json` và các batch, không cần image. Làm bước này sớm để biết khối lượng dịch còn phải làm, thay vì build xong mới phát hiện UI rơi về tiếng Anh.

`octop-orchester/patches/manifest.yaml` ghi `base_commit` — đó là commit mà bộ patch này được sinh ra. Lệch với commit hiện tại của submodule nghĩa là cần xem lại. `patches/lock.json` giữ sha256 của từng file upstream tại base đó, và `scripts/patch_status.py` so với cây hiện tại — nó bắt được cả trường hợp patch **vẫn áp được nhưng đã lệch** (upstream reindent anchor, hunk khớp nhờ context).

Không có bước đồng bộ Dockerfile: `octop/docker/Dockerfile` được dùng nguyên văn, nên upstream đổi cách build thì base đi theo, không cần sửa gì bên này. Registry trễ cũng không ảnh hưởng — base build từ đúng commit đang checkout.

Chỗ duy nhất phải để ý là `octop-orchester/Dockerfile` giả định base có sẵn ba thứ: `octop` cài editable trỏ `/app/src`, entrypoint ở `/usr/local/bin/docker-entrypoint.sh`, dashboard ở `/app/src/octop/dashboard`. Upstream đổi một trong ba thì lớp tuỳ biến cần sửa theo.

### 8.1. Đọc lỗi

```
FAILED: /tmp/patches/dashboard/src/App.tsx.vi-i18n.patch
error: patch failed: dashboard/src/App.tsx:51
error: dashboard/src/App.tsx: patch does not apply
```

Tên file patch cho biết ngay cần đụng file nào. Số `:51` là dòng trong **upstream**, nhưng đừng tin số dòng — upstream đổi thì số dòng trôi. Tin **anchor**: cột "Anchor" ở §4 chính là đoạn code cần tìm.

### 8.2. Rebase một patch

Làm trong worktree tạm của upstream, để submodule vẫn sạch:

```bash
git -C octop worktree add /tmp/octo-rebase HEAD
cd /tmp/octo-rebase
```

Áp phần patch còn khớp được:

```bash
git apply --reject /path/to/octop-orchester/patches/dashboard/src/App.tsx.vi-i18n.patch
```

`--reject` áp hunk nào khớp, để lại hunk nào hỏng trong `App.tsx.rej`. Đọc `.rej`, tìm anchor trong file mới, tự sửa file cho đúng ý định (xem bảng §4 — cột "Thay bằng" nói rõ đích đến), rồi sinh lại patch **chỉ cho file đó**:

```bash
git diff -- dashboard/src/App.tsx > /path/to/octop-orchester/patches/dashboard/src/App.tsx.vi-i18n.patch
```

Kiểm tra patch mới: đúng một header `diff --git`, không có `--- /dev/null` (file mới thì đặt ở `src/`, xem §2).

Dọn worktree tạm khi xong:

```bash
cd /path/to/repo && git -C octop worktree remove --force /tmp/octo-rebase
```

### 8.3. Những trường hợp upgrade hay đụng

| Upstream thay đổi | Patch nào fail | Xử lý |
|---|---|---|
| Đổi `UiLocale` / `normalizeUiLocale` / `detectBrowserLocale` trong `localePrefs.ts` | `localePrefs.ts` + mọi patch gọi `normalizeUiLocale` (`AvatarDropdown`, `Setup`, `Invite`, `request.ts`, `decision.ts`, `App.tsx`) | Sửa `localePrefs.ts` trước, giữ nguyên chữ ký `normalizeUiLocale(raw): UiLocale`, các patch còn lại mới áp được |
| Thêm locale thứ ba vào upstream | Tất cả | **Bỏ patch vi-i18n**, dùng locale có sẵn của upstream, chỉ giữ 2 file `vi.json` |
| Đổi cấu trúc `locales/en.json` (thêm/xoá key) | `en.json`, và parity `vi.json` lệch | `sync_batches.py` → `--write` → dịch batch mới → `merge.py` → `check_parity.py` (§7.2) |
| Đổi `loadLocaleBundle` / `supportedLngs` trong `i18n.ts` | `i18n.ts` | Thêm nhánh `vi` vào chỗ mới; anchor là 5 chỗ liệt kê ở §4.3 |
| Đổi mảng `options` của `Segmented` ở 3 trang | 3 patch tương ứng | Thêm `{ label: t("account.langVi"), value: "vi" }` vào mảng mới |
| Đổi `Accept-Language` (ví dụ dùng `navigator.language` hoặc helper khác) | `request.ts`, `decision.ts` | Thay bằng `normalizeUiLocale(i18n.language)`, giữ nguyên 3 vị trí §4.5 |
| `Literal["zh","en"]` đổi vị trí hoặc tên biến trong `locale.py` | `locale.py` | Thêm `"vi"` vào cả type lẫn `SUPPORTED_LOCALES`, và nhánh `normalize_locale` |
| Đổi tên `_load_all` / vòng lặp locale trong `loader.py` | `loader.py` | Thêm `"vi"` vào vòng lặp nạp file |
| Panel chọn ngôn ngữ được thêm vào chỗ khác (route `Settings/Language` được bật lại) | không fail, nhưng thiếu tiếng Việt | Kiểm tra lại 3 file ở §3 bằng `grep -rn "langEn" dashboard/src` — chỗ nào render `langEn` là chỗ cần option `vi` |
| `octop init` đổi cách tạo admin (ví dụ gọi qua `UserManager` thay vì `UserRepo`) | `src/octop/cli/commands/init.py` (`en-default`) | Chỉ cần đảm bảo admin tạo ra có `locale="en"`; xem lại §4.11 để biết vì sao không đụng `DEFAULT_LOCALE` |

Sau khi sửa xong tất cả, cập nhật `base_commit` và `base_describe` trong `patches/manifest.yaml`:

```bash
cd octop && git rev-parse --short HEAD && git describe --tags
```

### 8.4. Sau khi rebase

1. `git status` trong `octop/` phải sạch — lớp tuỳ biến không được commit vào submodule.
2. Build lại, xem 24 dòng `applying` không có `FAILED`.
3. Chạy §6.
4. Commit bộ patch mới.

---

## 9. Rollback

Bỏ một patch = xoá file `.vi-i18n.patch` tương ứng. Bỏ toàn bộ i18n = xoá `patches/dashboard`, `patches/src`, và `src/` rồi build lại.

Riêng 2 file `vi.json` thì vô hại khi còn: không có gì import chúng nếu thiếu patch — chúng chỉ chiếm chỗ trong bundle, không nằm trong rổ chunk nào.

Không có migration DB, không có dữ liệu cần hoàn tác. Preference `locale` đã lưu `"vi"` trong DB vẫn đọc được; `normalize_locale` của upstream sẽ fallback về `"en"` — người dùng thấy tiếng Anh, không lỗi.

Với dữ liệu runtime: `docker compose down` (không `-v`) xoá container, giữ cả `<repo>/data` trên host lẫn volume venv. `docker compose down -v` xoá thêm volume venv — lần `up` sau seed lại từ image, mất gói cài từ UI. `rm -rf ../data` xoá dữ liệu người dùng. Ba mức độc lập, chọn theo ý muốn.

## 10. Bảo mật

`.env` (chứa mật khẩu admin mặc định) và `.claude/settings.json` (chứa token) đều nằm trong `.gitignore`. Không commit hai file này.

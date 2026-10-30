# Flows — hướng dẫn tiếp tục (thêm node, hoàn thiện builder)

| Dự án | Octop-Orchester |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-10-30 |
| Mục đích | Bàn giao giữa các phiên làm việc: đọc file này là đủ để **thêm node tiếp theo** hoặc làm nốt builder mà không cần ai nhắc lại. |
| Tham chiếu | [04-FLOWS-ARCHITECTURE](04-FLOWS-ARCHITECTURE.md) (thiết kế, kiểm kê chức năng Orchester, danh mục 31 node), [plan khung builder](superpowers/plans/2026-10-30-flows-builder.md), [plan danh sách + thêm flow](superpowers/plans/2026-10-30-flows-list-and-create.md), [00-PATCH-REGISTRY](00-PATCH-REGISTRY.md) |

## 1. Đang ở đâu

**Mục tiêu:** đưa chức năng Flows của Orchester sang Octop, **từng component một**, bám Orchester tối đa. Backend/engine chưa làm; dữ liệu flow đang lưu giả trong `localStorage` qua interface `flowApi`.

| Hạng mục | Trạng thái |
|---|---|
| Mục sidebar "Luồng tự động" (`/flows`), route, i18n en/zh/vi, whitelist backend | **Xong** |
| Trang danh sách (nhóm theo trạng thái, tìm kiếm, đổi trạng thái, xoá) | **Xong** |
| Thêm flow (chọn mẫu Trống / FAQ / Báo khi có tin nhắn) | **Xong** |
| Khung builder `/flows/:flowId`: toolbar (tên, trạng thái, Lưu, Chạy tắt), 3 cột | **Xong** |
| Canvas xyflow, thẻ node, nối dây, xoá, kéo thả, hướng dẫn khi canvas trống | **Xong** |
| Palette: ô tìm kiếm + **đủ 6 nhóm** (đếm số node, "Chưa có bước nào"), kéo thả/bấm để thêm | **Xong** (chưa có node nào) |
| Inspector khung: tên node, nút xoá, chỗ cắm `renderFields` | **Xong** (chưa có field) |
| **Catalog node** (`NODE_REGISTRY`) | **Rỗng — mỗi node làm xong mới lên UI** |
| Undo/redo, copy/paste/nhân bản, tidy, panel kiểm tra lỗi, autosave (Task 6 của plan builder) | **Chưa làm** |
| Badge "AI steps: x of y" trên toolbar (B17) | Chưa làm; nên làm cùng node `agent` |
| Backend, engine, lịch sử chạy, Copilot, group/extract, docs/kind panel | Chưa làm (spec §3) |

Nút **Chạy** hiện nhưng tắt (cần engine). Node của mẫu FAQ / Báo tin (`trigger`, `agent`, `notify`) đang vẽ bằng **thẻ dự phòng** (icon hộp xám) vì chưa có trong catalog; chúng có icon/màu riêng khi node tương ứng được làm.

**Cách xem:** `cd octop-orchester && docker compose --progress=plain up -d --build` rồi mở http://localhost:9088 (cổng trong `.env`), Ctrl+F5, menu **Luồng tự động**. Dữ liệu flow nằm trong localStorage của trình duyệt (khoá `octop.flows.v1`); xoá khoá đó để về trạng thái trống.

## 2. Nguyên tắc đã chốt (đừng hỏi lại)

1. **Không sửa `octop/` (submodule).** Code mới là file overlay ở `octop-orchester/src/`; chỗ buộc phải nối vào upstream thì patch tối thiểu ở `octop-orchester/patches/`. Thang ưu tiên: config → plugin → customize; với trang/route/sidebar chỉ customize là được (spec §2).
2. **Node lên UI từng cái một, trọn gói** (catalog + palette + thẻ + field + validate + test). Không dựng sẵn node chưa có logic.
3. **Bám Orchester**: port logic thuần, viết lại UI bằng antd + less module (không Tailwind/HeroUI/framer-motion/sonner). Thư viện UI: spec §4.
4. **Không thêm dependency**, không patch `package.json`. Tidy layout là layout phân tầng thuần (không dagre) giữ chữ ký `autoLayout` của Orchester.
5. **Catalog chỉ giữ i18n key**, không giữ chuỗi: `flows.nodes.<id>.*`. Mọi chuỗi UI qua `t("flows.…")` với đủ en/zh/vi.
6. **Patch id là `workflow-ui`** (không phải `flows`): patch áp theo tên file và phải xếp sau `org-chart`. Giữ id này cho mọi chỉnh sửa locale/sidebar/route của Flows; phần backend sau này dùng id mới xếp sau nó (gợi ý `workflow-api`).
7. **TDD**: viết test, xem nó đỏ vì đúng lý do, rồi mới cài. Mỗi bước kiểm tra bằng lệnh ở §5.
8. **Quy trình làm việc với người dùng**: một task = một lần duyệt; người dùng muốn **thấy giao diện** sau mỗi bước (build và chạy container rồi báo cách xem). Không commit/push nếu chưa được yêu cầu.

## 3. Thêm một node — từng bước

Ví dụ: thêm `trigger_manual`. Mỗi node làm đủ các bước dưới, rồi dừng cho người dùng xem.

**0. Đọc định nghĩa gốc.** Entry của node trong `orchester/apps/web/lib/flows/node-registry.ts` (số dòng ở §4) và cách form render field trong `orchester/apps/web/components/flows/inspector/InspectorForm.tsx` (hàm `FieldRenderer`, các `case` ở §4). Danh sách field/loại field của từng node: spec §6.2.

**1. Catalog** — thêm một entry vào `NODE_REGISTRY` trong `src/dashboard/src/pages/Flows/lib/node-catalog.ts`:

```ts
export const NODE_REGISTRY: Record<string, NodeDef> = {
  trigger_manual: {
    id: "trigger_manual",
    engine: "trigger",               // ∈ FLOW_NODE_TYPES (lib/node-types.ts)
    category: "trigger",             // trigger | ai | logic | apps | data | actions
    icon: "Play",                    // tên lucide, phải có trong Builder/nodes/icon-map.ts
    accent: "#10b981",
    fields: [],                      // FieldDef[]: {key,type,required?,advanced?,options?,dependsOn?}
    fixedConfig: { triggerKind: "manual" },   // trigger: id = trigger_<kind>
    // defaults: { … }               // config khởi tạo khi kéo node vào canvas
    // outputs: ["true","false"]     // node rẽ nhánh: id các handle nguồn
  },
};
```

Các bất biến trong `node-catalog.test.ts` tự kiểm: khoá = `id`, `engine` hợp lệ, nhóm hợp lệ, field không trùng key, trigger khớp `triggerKind`.

**2. Icon** — thêm icon vào `NODE_ICONS` trong `Builder/nodes/icon-map.ts` (`import { Play } from "lucide-react"` rồi `Play`). Test `icon-map.test.ts` bắt thiếu icon hoặc tên không tồn tại ở lucide-react 0.562.

**3. Copy i18n** — thêm vào `COPY` (en, zh, vi) trong `scripts/add_flows_i18n.py`, dưới `group`:

```python
"nodes": {"trigger_manual": {
    "title": "Manual start", "summary": "Starts when you run it by hand or via API.",
    "fields": {"<key>": {"label": "…", "help": "…", "placeholder": "…", "example": "…",
                          "options": {"<value>": "…"}}},     # options chỉ cho select
    "outputs": {"true": "Yes", "false": "No"},               # chỉ node rẽ nhánh
}},
```

Tên en lấy từ spec §6.2, mô tả vi dùng cột "Làm gì". Sau đó **sinh lại patch locale** (en/zh là patch, vi là file overlay):

```bash
python octop-orchester/scripts/regen_flows_locale_patches.py
python octop-orchester/scripts/add_flows_i18n.py --check     # mọi t("flows.…") tĩnh đều có copy
```

Test `lib/node-copy.test.ts` kiểm **mọi node trong catalog có đủ copy ở 3 ngôn ngữ** (tên, mô tả, nhãn field, nhãn option, nhãn output).

**4. Field cấu hình** (node có `fields`): lần đầu tiên node có field, tạo `Builder/fields/FieldRenderer.tsx` xuất `renderNodeFields(node, onChange)` (render theo `FieldDef.type`, đọc/ghi `node.data.config[key]`, bám `FieldRenderer` của Orchester), rồi truyền `renderFields={renderNodeFields}` cho `<Inspector>` trong `Builder/index.tsx`. `Inspector` đã chừa chỗ cắm này và **không gọi** `renderFields` với node chưa có trong catalog. Mỗi node chỉ thêm các `FieldType` mà nó cần và chưa có renderer; picker dùng dữ liệu thật của octop: agent từ `useAgent().agents` (`context/AgentContext`), kênh từ `channelApi` (`api/modules/channel.ts`), cron cần ô nhập tự viết (kèm preset). Field `dependsOn` ẩn/hiện theo field khác; field `advanced` gom dưới mục "Nâng cao".

**5. Validate** — field `required` bị bỏ trống phải báo lỗi: thêm mã `missing_field` vào `ValidationCode` và quy tắc trong `lib/validate.ts` (hàm cần tra `getNodeDef(registryIdOf(...))`, tôn trọng `dependsOn`); kèm test. Khi Task 6 làm panel kiểm tra, thêm câu chữ cho mã đó (`flows.builder.issueMissingField`).

**6. Node rẽ nhánh** (`condition`, `switch`…): card riêng hiển thị nhiều handle nguồn có nhãn từ `def.outputs`. Hôm nay `NodeCard` chỉ vẽ một handle nguồn và `addNodeToGraph` chưa chọn `sourceHandle` theo `outputs` — cả hai cần mở rộng cùng test khi làm node đầu tiên có `outputs`.

**7. Test của node** (viết trước): palette có node trong đúng nhóm (đã có test palette dùng registry giả, thêm một test dùng entry thật); thêm node vào đồ thị cho `config` mặc định đúng; từng field render và ghi đúng vào `config`; field bắt buộc trống bị báo; round-trip lưu/tải. **Khi một node mà mẫu (`lib/templates.ts`) đang dùng được làm xong**, thêm vào `node-catalog.test.ts` khẳng định "mọi node của template phân giải được trong catalog" khi cả `trigger_message`, `agent`, `notify` đã có.

**8. Kiểm tra, build, báo cách xem** — lệnh ở §5; sau khi build, báo người dùng: node nằm ở nhóm nào của palette, cách kéo vào canvas và cấu hình.

## 4. Backlog node và điểm tra cứu trong Orchester

`node-registry.ts` ở `orchester/apps/web/lib/flows/`. Mô tả, field, đợt và điểm nối Octop của từng node: spec §6.2. Gợi ý thứ tự: đợt 1 → đợt 2 → đợt 3; **người dùng chọn node làm trước**. Thứ tự đã đề xuất: `trigger_manual`, `trigger_message`, `agent`, `notify` (để hai mẫu chạy bằng node thật), rồi `trigger_schedule`, `condition`, `http`, `note`.

| Đợt | Node (dòng trong `node-registry.ts`) |
|---|---|
| 1 | `trigger_manual` 42 · `trigger_message` 57 · `trigger_schedule` 79 · `agent` 119 · `condition` 501 · `http` 681 · `notify` 932 · `note` 1021 |
| 2 | `trigger_webhook` 102 · `switch` 540 · `loop_for_each` 569 · `parallel` 592 · `try_catch` 606 · `code` 620 · `transform` 746 · `delay` 910 · `wait_human` 962 · `subflow` 983 |
| 3 | `kb_search` 149 · `generate_image` 187 · `llm_prompt` 237 · `generate_video` 292 · `text_to_speech` 330 · `transcribe` 376 · `generate_avatar` 415 · `generate_music` 462 · `integration` 644 · `spreadsheet` 769 · `embed_text` 790 · `rerank` 829 · `ocr_extract` 876 |

Cách form render từng loại field trong `InspectorForm.tsx` (`FieldRenderer`): `textarea/variable/code` 264 · `number` 285 · `boolean` 298 · `select` 310 · `cron` 328 · `duration` 346 · `json` 364 · `spreadsheet` 377 · `model-picker` 379 · `string-list` 390 · `key-value` 392 · `agent-picker` 394 · `kb-picker` 405 · `channel-picker` 416 · `integration-action` 431 · `text` 441.

## 5. Lệnh hay dùng (chạy từ gốc repo, Git Bash)

| Việc | Lệnh |
|---|---|
| Chạy test Flows | `bash octop-orchester/scripts/dashboard_test.sh src/pages/Flows` (thêm `src/api/modules/flows.test.ts`) |
| Chạy cả bộ test dashboard | `bash octop-orchester/scripts/dashboard_test.sh` |
| Type-check | `bash octop-orchester/scripts/dashboard_test.sh --tsc` (hiện **sạch**, exit 0) |
| ESLint + Prettier (kiểm) | `bash octop-orchester/scripts/dashboard_test.sh --lint [đường dẫn]` (mặc định: code Flows) |
| Tự định dạng bằng Prettier | `bash octop-orchester/scripts/dashboard_format.sh [đường dẫn]` |
| Sinh lại patch locale + vi.json | `python octop-orchester/scripts/regen_flows_locale_patches.py` |
| Kiểm key i18n | `python octop-orchester/scripts/add_flows_i18n.py --check` và `python octop-orchester/scripts/vi-i18n/check_parity.py` |
| Patch có áp sạch không | `python octop-orchester/scripts/patch_status.py --apply-check` |
| Ghi khoá + sổ patch | `python octop-orchester/scripts/patch_status.py --record` rồi `--report` |
| Build và chạy | `cd octop-orchester && docker compose --progress=plain up -d --build` (**`--progress` đứng trước `up`**) |
| Xác nhận bản mới | `docker ps` (healthy), `curl -s -o /dev/null -w "%{http_code}" http://localhost:9088/flows` (200) |

`dashboard_test.sh` dựng bản overlay đã áp patch trong Docker (lần đầu chậm vì `npm ci`, sau đó có cache).

**Baseline test đỏ có sẵn** (không phải của Flows, không tính vào thay đổi): 9 test — `knowledgeBases`, `publishedExperts`, `AuthGuard`, `docxSanitize`, `SkillDrawer`, `skillMarkdown`, `ChatInput.prefill` (4), `ModelListEditor`, `sidebarNavLayout › omits nav items and built-in groups the user cannot access`. Toàn bộ test Flows xanh (138 test lúc viết tài liệu).

## 6. Bẫy đã gặp

- **Thứ tự patch**: id patch quyết định thứ tự áp (theo tên file); đặt id sai làm hỏng context của patch khác. Giữ `workflow-ui`.
- **Patch locale không sửa tay**: luôn sinh lại bằng `regen_flows_locale_patches.py` (nó dựng worktree upstream, áp mọi patch trừ locale của Flows, rồi `git diff`). Script từ chối chạy nếu `octop/` đang bẩn.
- **Test i18n**: `react-i18next` bị mock, `t(key)` trả về chính key và **mỗi lần render là một hàm `t` mới**. Đừng đưa `t` vào deps của `useEffect`/`useCallback` dùng để tải dữ liệu (dùng `tRef`), nếu không sẽ tải lại vô hạn.
- **`it.each([])` trên mảng rỗng làm vitest báo "No test found"**: với catalog rỗng, dùng một test lặp (như `node-catalog.test.ts`).
- **xyflow trong jsdom**: handle có class `.react-flow__handle.source|target`; cạnh không vẽ vì chưa đo kích thước, nên kiểm cạnh qua `save()`/payload thay vì DOM.
- **Edit tool cần Read trước**; sửa hàng loạt thì dùng script Python có `assert` số lần xuất hiện. Heredoc bash chứa `'''` lỗi cú pháp: ghi script ra file rồi chạy.
- **Định dạng**: upstream đạt Prettier 3.0.0 cấu hình mặc định; code Flows cũng phải đạt (`--lint`). Một số file overlay cũ (Agencies, OrgChart…) chưa đạt — không bắt buộc sửa.
- **`git apply` in cảnh báo `has type 100755`** là nhiễu từ mode file Windows, không phải lỗi.
- **Trình duyệt giữ bundle cũ**: báo người dùng nhấn Ctrl+F5.
- **Docker build cache lớn** (hàng chục GB): `docker builder prune` giải phóng nhưng lần build sau lâu hơn; chỉ làm khi người dùng đồng ý.

## 7. Nhật ký quyết định (tóm tắt)

| Quyết định | Lý do |
|---|---|
| Patch id `workflow-ui`, không phải `flows` | Thứ tự áp patch; xếp sau `org-chart` |
| Có patch backend `preferences.py` (whitelist `SIDEBAR_NAV_KEYS`) | Không có khoá `flows` ở server thì lưu layout sidebar bị từ chối |
| Layout phân tầng thuần, không dagre | dagre không có trong lockfile; patch lock giòn, cần mạng |
| Nút Chạy hiện nhưng tắt | Thấy đúng bố cục cuối; cần engine |
| Chỉ 4 quy tắc validate lúc đầu (thiếu trigger, cạnh gãy, node rời + `missing_field` theo node) | 2 quy tắc còn lại của Orchester (thiếu tài liệu, ánh xạ subflow) thuộc phần làm sau |
| `addNodeToGraph` đặt vị trí mặc định xác định (cascade) thay vì ngẫu nhiên | Hàm thuần dễ test |
| `icon-map` bắt đầu rỗng | Mỗi node tự thêm icon của nó |
| `setStatus` lưu ngay (lạc quan, hoàn tác khi lỗi); nút Lưu chỉ lưu tên + đồ thị | Đổi trạng thái là hành động độc lập |
| Inspector node ngoài catalog hiện loại engine làm tiêu đề | Node có tên đọc dễ hơn "Bước chưa đặt tên" |
| Palette luôn hiện đủ 6 nhóm, kể cả nhóm rỗng | Người dùng muốn thấy các nhóm trước; node lên dần |
| Sửa 4 lỗi type-check của `Settings/Webhooks` (bỏ import thừa, kiểu form riêng) | Người dùng yêu cầu; `tsc -b` giờ sạch |
| `regen_flows_locale_patches.py`, `dashboard_format.sh`, cờ `--lint` | Mỗi task đều cần sinh lại patch / định dạng; làm tay lặp lại dễ sai |

## 8. Việc kế tiếp (đề xuất)

1. **Chọn node đầu tiên** và làm theo §3 (gợi ý `trigger_manual`; tạo luôn `Builder/fields/FieldRenderer.tsx` khi node đầu tiên có field).
2. **Task 6 của plan builder** (undo/redo, copy/paste, tidy, kiểm tra lỗi, autosave) — làm trước, giữa, hoặc sau các node đều được; plan chi tiết ở [plan khung builder](superpowers/plans/2026-10-30-flows-builder.md).
3. Sau khi có đủ node đợt 1: backend + engine (kế hoạch ở spec §2 và §3.3; tái dùng cron/channels/agents có sẵn của octop; patch mới id `workflow-api`).

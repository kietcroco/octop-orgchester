# Patch vi-i18n — Vietnamese UI localization

## 1. ID và tên

`vi-i18n` — Vietnamese (vi) UI localization cho Octop.

## 2. Mục tiêu nghiệp vụ

Octop upstream chỉ hỗ trợ `zh` và `en`. Cần thêm tiếng Việt (`vi`) làm locale thứ ba cho
toàn bộ dashboard và các chuỗi backend i18n, không phá vỡ zh/en.

## 3. Hành vi upstream hiện tại

- `src/octop/infra/utils/locale.py`: `Locale = Literal["zh", "en"]`, `SUPPORTED_LOCALES = ("zh", "en")`.
- `src/octop/i18n/loader.py`: `_load_all()` chỉ nạp `en.json`, `zh.json`.
- `dashboard/src/i18n.ts`: chỉ import `zh.json` / `en.json`, `supportedLngs: ["zh", "en"]`.
- `dashboard/src/utils/localePrefs.ts`: `UiLocale = "zh" | "en"`.
- `LanguageSwitcher` / `Settings/Language` chỉ render 2 lựa chọn.

## 4. Hành vi mong muốn

- `vi` là locale hợp lệ ở cả backend và frontend, có trong bộ chọn ngôn ngữ.
- Chuyển sang `vi` → toàn bộ UI và skill/tool labels hiển thị tiếng Việt; thiếu key thì fallback `en`.
- Preference `locale` lưu được `vi` qua API `/preferences`.

## 5. File upstream bị sửa

| File | Thay đổi |
|---|---|
| `src/octop/infra/utils/locale.py` | thêm `vi` vào `Locale`, `SUPPORTED_LOCALES`, `normalize_locale` |
| `src/octop/i18n/loader.py` | nạp `vi.json` trong `_load_all()` |
| `src/octop/i18n/vi.json` | **file mới** — 834 leaf strings dịch từ `zh.json` |
| `src/octop/api/routers/preferences.py` | docstring `locale` → `zh`, `en`, hoặc `vi` |
| `dashboard/src/i18n.ts` | nhánh import `vi.json`, `supportedLngs` thêm `vi`, detect locale |
| `dashboard/src/utils/localePrefs.ts` | `UiLocale` thêm `vi`, browser detect, storage |
| `dashboard/src/locales/vi.json` | **file mới** — 6628 leaf strings, khớp key 1:1 với `en.json` |
| `dashboard/src/components/LanguageSwitcher.tsx` | thêm nút `VI`, helper `currentLocale` |
| `dashboard/src/pages/Settings/Language/index.tsx` | thêm option `Tiếng Việt` |

## 6. Vì sao settings không đáp ứng

Octop không có setting nào để thêm locale mới — danh sách locale bị hardcode trong
`Literal` type ở backend và `supportedLngs` ở frontend. Không có extension point cho i18n.

## 7. Vì sao public API không đáp ứng

`/api/preferences` chỉ lưu chuỗi `locale`; nó không làm backend/frontend biết thêm một locale
mới. Thiếu phần resource và danh sách locale hợp lệ.

## 8. Vì sao extension/plugin không đáp ứng

Plugin loader của Octop không có hook đăng ký locale bundle hay patch `supportedLngs`
ở dashboard build.

## 9. Thay đổi tối thiểu

Chỉ 4 dòng logic (2 backend, 2 frontend) + 2 file resource JSON mới + 3 điểm UI hiển thị
lựa chọn. Không đổi schema DB, không đổi API contract.

## 10. Test / verify

- Key parity: `vi.json` có đúng 6628 (dashboard) và 834 (backend) leaf key, khớp `en.json` 100%, không dư không thiếu.
- Không còn chuỗi CJK trong `vi.json` (đã sửa `common.installLogEmpty`, `scenes.shortVideoDesc`).
- Patch apply sạch trên `890111b7` (pristine clone) — verify từng file byte-identical với cây làm việc.
- Smoke: build image, mở dashboard, chuyển sang Tiếng Việt, reload → ngôn ngữ giữ nguyên.

## 11. Apply

Tự động trong image build:

- Stage `frontend-builder`: `git apply --include='dashboard/*'` trước `npm run build:docker`.
- Stage `runtime`: `git apply --include='src/*'` sau `COPY octop/src/`.

## 12. Rollback

Bỏ `octop-orchester/patches/vi-i18n/` (hoặc đổi `status` trong `manifest.yaml`) rồi build lại.
Không có migration, không có dữ liệu cần hoàn tác.

## 13. Rủi ro khi nâng cấp upstream

Patch neo vào `890111b7`. Khi bump submodule `octop/`, `git apply` sẽ fail rõ ràng ở bước build
nếu upstream đổi các file trên. Xử lý: rebase các hunk trong `patch.diff`, cập nhật
`base_commit` trong `manifest.yaml`.

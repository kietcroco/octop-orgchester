# Codespace scanning

Khi cần hiểu cấu trúc code, logic hay quan hệ giữa các hạng mục trong `octop/` hoặc `orchester/` (vị trí source, call path, dependency), **ưu tiên dùng Repomix pack** trước khi grep/đọc tay. Mỗi repo có pack riêng (không gộp chung):

- `octop/` → skill `repomix-reference-octop` → `.claude/skills/repomix-reference-octop/references/`
- `orchester/` → skill `repomix-reference-orchester` → `.claude/skills/repomix-reference-orchester/references/`

## Tra cứu trong pack

- Vị trí file + số dòng: grep trong `references/project-structure.md`
- Nội dung file: grep `## File: <path>` trong `references/files.md`
- Symbol/call site: grep tên hàm/class trong `references/files.md`
- Dependency theo package: grep `## Tech Stack: <path>` trong `references/tech-stacks.md`
- Thống kê, file bị loại: `references/summary.md`

Pack là ảnh chụp tại thời điểm chạy, không phải live source. Nếu pack cũ hơn source, rebuild trước khi kết luận.

## Rebuild khi source đổi

```bash
repomix octop --skill-generate repomix-reference-octop \
  --skill-project-name "Octop" \
  --skill-output .claude/skills/repomix-reference-octop -f

repomix orchester --skill-generate repomix-reference-orchester \
  --skill-project-name "Orchester" \
  --skill-output .claude/skills/repomix-reference-orchester -f
```

# repomix

- **repomix-reference-octop** (`.claude/skills/repomix-reference-octop/SKILL.md`) - pack toàn bộ `octop/`.
- **repomix-reference-orchester** (`.claude/skills/repomix-reference-orchester/SKILL.md`) - pack toàn bộ `orchester/`.

# Flows (octop-orchester) — đang làm dở, đọc trước khi tiếp tục

Đưa chức năng **Flows** của Orchester sang Octop (trang `/flows`, menu "Luồng tự động"), bám Orchester, **từng component / từng node một**. Code ở `octop-orchester/src/dashboard/src/pages/Flows/` (overlay) + patch id `workflow-ui` ở `octop-orchester/patches/`; không sửa submodule `octop/`.

**Bắt đầu từ `octop-orchester/docs/05-FLOWS-NODE-GUIDE.md`**: trạng thái hiện tại, cách thêm một node từng bước, lệnh test/lint/build, bẫy đã gặp, nhật ký quyết định. Thiết kế đầy đủ: `octop-orchester/docs/04-FLOWS-ARCHITECTURE.md`; plan: `octop-orchester/docs/superpowers/plans/`.

Tóm tắt: khung builder (toolbar, palette 6 nhóm, canvas, inspector) đã xong, **catalog node còn rỗng** — mỗi node thêm trọn gói (catalog + icon + copy i18n en/zh/vi + field + validate + test). Chưa có backend/engine. Còn Task 6 (undo/redo, tidy, kiểm tra lỗi, autosave). Người dùng muốn thấy giao diện sau mỗi bước (build + chạy container rồi báo cách xem) và không muốn commit/push nếu chưa yêu cầu.

"""Insert the agencies nav item + locale group into en.json / zh.json / vi.json.

Idempotent: skips a file that already has a top-level "agencies" group.

    python octop-orchester/scripts/add_agencies_i18n.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

COPY = {
    "en": {
        "nav": "Agencies",
        "group": {
            "title": "Agencies",
            "subtitle": "Group experts into departments and see the channels they touch.",
            "create": "New agency",
            "createTitle": "New agency",
            "editTitle": "Edit agency",
            "name": "Name",
            "namePlaceholder": "e.g. Engineering",
            "description": "Description",
            "descriptionPlaceholder": "What does this team do?",
            "color": "Color",
            "save": "Save",
            "cancel": "Cancel",
            "delete": "Delete",
            "deleteConfirm": "Delete this agency?",
            "deleteConfirmDesc": "Only the grouping is removed. The experts themselves are kept.",
            "empty": "No agencies yet",
            "emptyHint": "Create one to group experts by department.",
            "searchPlaceholder": "Search agencies",
            "agentCount": "expert(s)",
            "channelCount": "channel(s)",
            "agents": "Experts",
            "channels": "Channels",
            "addAgents": "Add experts",
            "removeAgent": "Remove from agency",
            "noAgents": "No experts in this agency yet",
            "noChannels": "No channels yet",
            "agentAgencies": "Agencies",
            "agentAgenciesPlaceholder": "Select agencies",
            "nameTaken": "That name is already in use",
            "loadFailed": "Could not load agencies",
            "saveFailed": "Could not save the agency",
            "deleteFailed": "Could not delete the agency",
            "back": "All agencies",
            "members": "Members",
        },
    },
    "zh": {
        "nav": "部门",
        "group": {
            "title": "部门",
            "subtitle": "把专家分组到部门，并查看它们涉及的渠道。",
            "create": "新建部门",
            "createTitle": "新建部门",
            "editTitle": "编辑部门",
            "name": "名称",
            "namePlaceholder": "例如：研发部",
            "description": "描述",
            "descriptionPlaceholder": "这个团队负责什么？",
            "color": "颜色",
            "save": "保存",
            "cancel": "取消",
            "delete": "删除",
            "deleteConfirm": "删除这个部门？",
            "deleteConfirmDesc": "只删除分组关系，专家本身会保留。",
            "empty": "还没有部门",
            "emptyHint": "新建一个部门，把专家按部门归类。",
            "searchPlaceholder": "搜索部门",
            "agentCount": "位专家",
            "channelCount": "个渠道",
            "agents": "专家",
            "channels": "渠道",
            "addAgents": "添加专家",
            "removeAgent": "从部门移除",
            "noAgents": "该部门还没有专家",
            "noChannels": "还没有渠道",
            "agentAgencies": "所属部门",
            "agentAgenciesPlaceholder": "选择部门",
            "nameTaken": "该名称已被使用",
            "loadFailed": "加载部门失败",
            "saveFailed": "保存部门失败",
            "deleteFailed": "删除部门失败",
            "back": "全部部门",
            "members": "成员",
        },
    },
    "vi": {
        "nav": "Phòng ban",
        "group": {
            "title": "Phòng ban",
            "subtitle": "Gom chuyên gia theo phòng ban và xem các kênh mà phòng ban đang chạm tới.",
            "create": "Tạo phòng ban",
            "createTitle": "Tạo phòng ban",
            "editTitle": "Sửa phòng ban",
            "name": "Tên",
            "namePlaceholder": "ví dụ: Kỹ thuật",
            "description": "Mô tả",
            "descriptionPlaceholder": "Phòng ban này làm gì?",
            "color": "Màu",
            "save": "Lưu",
            "cancel": "Hủy",
            "delete": "Xóa",
            "deleteConfirm": "Xóa phòng ban này?",
            "deleteConfirmDesc": "Chỉ xóa liên kết nhóm. Bản thân chuyên gia vẫn được giữ nguyên.",
            "empty": "Chưa có phòng ban",
            "emptyHint": "Tạo một phòng ban để gom chuyên gia theo bộ phận.",
            "searchPlaceholder": "Tìm phòng ban",
            "agentCount": "chuyên gia",
            "channelCount": "kênh",
            "agents": "Chuyên gia",
            "channels": "Kênh",
            "addAgents": "Thêm chuyên gia",
            "removeAgent": "Gỡ khỏi phòng ban",
            "noAgents": "Phòng ban chưa có chuyên gia",
            "noChannels": "Chưa có kênh",
            "agentAgencies": "Phòng ban",
            "agentAgenciesPlaceholder": "Chọn phòng ban",
            "nameTaken": "Tên này đã được dùng",
            "loadFailed": "Không tải được danh sách phòng ban",
            "saveFailed": "Không lưu được phòng ban",
            "deleteFailed": "Không xóa được phòng ban",
            "back": "Tất cả phòng ban",
            "members": "Thành viên",
        },
    },
}

TARGETS = {
    "en": ROOT / "octop/dashboard/src/locales/en.json",
    "zh": ROOT / "octop/dashboard/src/locales/zh.json",
    "vi": ROOT / "octop-orchester/src/dashboard/src/locales/vi.json",
}

INDENT = "  "


def block_for(key: str, value: dict, depth: int) -> str:
    """Render ``"key": {...}`` as indented JSON lines, no trailing comma."""
    pad = INDENT * depth
    inner = json.dumps(value, ensure_ascii=False, indent=2).splitlines()[1:-1]
    return "\n".join(
        [pad + json.dumps(key, ensure_ascii=False) + ": {"]
        + [pad + ln for ln in inner]
        + [pad + "}"]
    )


def main() -> int:
    # Components render the number in JSX and never pass `count` to t(), so a
    # `{{count}}` here would surface literally in the UI.
    for lang, copy in COPY.items():
        for key, value in copy["group"].items():
            assert "{{" not in value, (lang, key, value)

    for lang, path in TARGETS.items():
        # Bytes, not text: these files are CRLF and text mode would rewrite them.
        text = path.read_bytes().decode("utf-8")
        nl = "\r\n" if "\r\n" in text else "\n"
        if '\n  "agencies": {' in text:
            print(f"skip {lang}: already present")
            continue
        data = json.loads(text)
        copy = COPY[lang]

        # nav.agencies, right after nav.experts (the "experts" label repeats in
        # other nav blocks, so scope the search to the first "nav": { block)
        nav_start = text.index('\n  "nav": {')
        nav_anchor = (
            f'\n    "experts": {json.dumps(data["nav"]["experts"], ensure_ascii=False)},'
        )
        hit = text.index(nav_anchor, nav_start)
        text = (
            text[: hit + len(nav_anchor)]
            + f'\n    "agencies": {json.dumps(copy["nav"], ensure_ascii=False)},'
            + text[hit + len(nav_anchor) :]
        )

        # top-level agencies group, right before "experts"
        top_anchor = '\n  "experts": {'
        assert text.count(top_anchor) == 1, (lang, "top anchor not unique")
        block = block_for("agencies", copy["group"], depth=1)
        text = text.replace(top_anchor, "\n" + block + "," + top_anchor, 1)

        if nl == "\r\n":
            # Inserted with \n only; normalise so the diff stays 2 hunks, not the file.
            text = text.replace("\r\n", "\n").replace("\n", "\r\n")

        json.loads(text)  # must still parse
        path.write_bytes(text.encode("utf-8"))
        print(f"updated {lang}: {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

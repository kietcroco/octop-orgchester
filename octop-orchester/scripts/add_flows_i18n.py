"""Insert the Flows nav item + locale group into en.json / zh.json / vi.json.

en/zh are upstream files, so they are written into ``--octop-dir`` (a scratch
worktree of octop with the existing patches applied), never into the submodule;
the patch is then produced with ``git diff``. vi.json is an overlay file and is
written in place.

en/zh must be run against a worktree that does NOT yet have the flows group
(scripts/regen_flows_locale_patches.py builds exactly that and turns the result
into the workflow-ui locale patches). vi.json is rewritten in place: its
`flows` group and `nav.flows` are replaced with the copy below every run.

    python octop-orchester/scripts/regen_flows_locale_patches.py   # normal use
    python octop-orchester/scripts/add_flows_i18n.py --check       # every t("flows.*") key has copy
"""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

COPY = {
    "en": {
        "nav": "Flows",
        "group": {
            "title": "Flows",
            "subtitle": "Build automations that react to messages and schedules.",
            "create": "Add flow",
            "searchPlaceholder": "Search flows",
            "empty": "No flows yet",
            "emptyHint": "Create your first flow to automate a repetitive task.",
            "loadFailed": "Could not load flows",
            "back": "All flows",
            "notFound": "Flow not found",
            "notFoundHint": "It may have been deleted. Go back to the list.",
            "stepCount": "steps",
            "updatedAt": "Updated",
            "status": {"active": "Active", "paused": "Paused", "draft": "Draft"},
            "actions": {
                "more": "More actions",
                "setActive": "Activate",
                "setPaused": "Pause",
                "setDraft": "Move to draft",
            },
            "delete": "Delete",
            "deleteConfirm": "Delete this flow?",
            "deleteConfirmDesc": "The flow and its steps will be removed. This cannot be undone.",
            "cancel": "Cancel",
            "deleteFailed": "Could not delete the flow",
            "statusFailed": "Could not change the status",
            "createTitle": "New flow",
            "template": "Start from",
            "name": "Name",
            "namePlaceholder": "e.g. Answer common questions",
            "description": "Description",
            "descriptionPlaceholder": "What does this flow do?",
            "save": "Create",
            "saveFailed": "Could not create the flow",
            "created": "Flow created",
            "categories": {"trigger": "Triggers", "ai": "AI", "logic": "Logic", "apps": "Connect apps", "data": "Data", "actions": "Actions"},
            "builder": {"back": "Back to flows", "nameLabel": "Flow name", "statusLabel": "Status", "save": "Save", "saved": "Flow saved", "saveFailed": "Could not save the flow", "run": "Run", "runDisabled": "Running a flow needs the flow engine, which is not available yet.", "emptyTitle": "Let's build your first flow", "emptyHint": "A flow is a sequence of automated steps. Start from a template, or add steps from the left panel as they become available.", "templatesTitle": "Start from a template", "startersTitle": "…or start with a trigger", "unknownNode": "Untitled step", "paletteSearch": "Search a step…", "paletteNoMatch": "No steps match your search", "inspectorEmpty": "Select a step to see its details.", "nodeName": "Step name", "nodeType": "Type", "deleteNode": "Delete step", "noSettingsYet": "This step has no settings yet.", "groupEmpty": "No steps yet"},
            "templates": {
                "blank": {
                    "name": "Blank flow",
                    "description": "Start with an empty canvas.",
                },
                "faq": {
                    "name": "Answer common questions",
                    "description": "When a message arrives, an agent replies.",
                    "nodes": {
                        "trigger": "When a message arrives",
                        "agent": "Reply with an agent",
                    },
                },
                "alert": {
                    "name": "Notify on a new message",
                    "description": "When a message arrives, send a notification.",
                    "nodes": {
                        "trigger": "When a message arrives",
                        "notify": "Send a notification",
                    },
                },
            },
        },
    },
    "zh": {
        "nav": "流程",
        "group": {
            "title": "流程",
            "subtitle": "构建响应消息和定时任务的自动化流程。",
            "create": "新建流程",
            "searchPlaceholder": "搜索流程",
            "empty": "暂无流程",
            "emptyHint": "创建第一个流程，自动完成重复性工作。",
            "loadFailed": "加载流程失败",
            "back": "全部流程",
            "notFound": "未找到该流程",
            "notFoundHint": "它可能已被删除，请返回列表。",
            "stepCount": "个步骤",
            "updatedAt": "更新于",
            "status": {"active": "启用中", "paused": "已暂停", "draft": "草稿"},
            "actions": {
                "more": "更多操作",
                "setActive": "启用",
                "setPaused": "暂停",
                "setDraft": "移到草稿",
            },
            "delete": "删除",
            "deleteConfirm": "删除此流程？",
            "deleteConfirmDesc": "流程及其步骤将被移除，且无法恢复。",
            "cancel": "取消",
            "deleteFailed": "删除流程失败",
            "statusFailed": "修改状态失败",
            "createTitle": "新建流程",
            "template": "从模板开始",
            "name": "名称",
            "namePlaceholder": "例如：解答常见问题",
            "description": "描述",
            "descriptionPlaceholder": "这个流程用来做什么？",
            "save": "创建",
            "saveFailed": "创建流程失败",
            "created": "流程已创建",
            "categories": {"trigger": "触发器", "ai": "AI", "logic": "逻辑", "apps": "连接应用", "data": "数据", "actions": "动作"},
            "builder": {"back": "返回流程列表", "nameLabel": "流程名称", "statusLabel": "状态", "save": "保存", "saved": "流程已保存", "saveFailed": "保存流程失败", "run": "运行", "runDisabled": "运行流程需要流程引擎，暂未提供。", "emptyTitle": "开始构建你的第一个流程", "emptyHint": "流程是一系列自动化步骤。可以从模板开始，也可以在左侧面板添加步骤（陆续开放）。", "templatesTitle": "从模板开始", "startersTitle": "…或从触发器开始", "unknownNode": "未命名步骤", "paletteSearch": "搜索步骤…", "paletteNoMatch": "没有匹配的步骤", "inspectorEmpty": "选择一个步骤以查看详情。", "nodeName": "步骤名称", "nodeType": "类型", "deleteNode": "删除步骤", "noSettingsYet": "该步骤暂无可配置项。", "groupEmpty": "暂无步骤"},
            "templates": {
                "blank": {"name": "空白流程", "description": "从空白画布开始。"},
                "faq": {
                    "name": "解答常见问题",
                    "description": "收到消息时由智能体回复。",
                    "nodes": {"trigger": "收到消息时", "agent": "由智能体回复"},
                },
                "alert": {
                    "name": "新消息提醒",
                    "description": "收到消息时发送通知。",
                    "nodes": {"trigger": "收到消息时", "notify": "发送通知"},
                },
            },
        },
    },
    "vi": {
        "nav": "Luồng tự động",
        "group": {
            "title": "Luồng tự động",
            "subtitle": "Xây dựng quy trình tự động phản hồi tin nhắn và chạy theo lịch.",
            "create": "Thêm luồng",
            "searchPlaceholder": "Tìm luồng",
            "empty": "Chưa có luồng nào",
            "emptyHint": "Tạo luồng đầu tiên để tự động hoá việc lặp đi lặp lại.",
            "loadFailed": "Không tải được danh sách luồng",
            "back": "Tất cả luồng",
            "notFound": "Không tìm thấy luồng",
            "notFoundHint": "Có thể luồng đã bị xoá. Hãy quay lại danh sách.",
            "stepCount": "bước",
            "updatedAt": "Cập nhật",
            "status": {"active": "Đang chạy", "paused": "Tạm dừng", "draft": "Nháp"},
            "actions": {
                "more": "Thao tác khác",
                "setActive": "Kích hoạt",
                "setPaused": "Tạm dừng",
                "setDraft": "Chuyển về nháp",
            },
            "delete": "Xoá",
            "deleteConfirm": "Xoá luồng này?",
            "deleteConfirmDesc": "Luồng và các bước của nó sẽ bị xoá, không thể hoàn tác.",
            "cancel": "Huỷ",
            "deleteFailed": "Không xoá được luồng",
            "statusFailed": "Không đổi được trạng thái",
            "createTitle": "Thêm luồng mới",
            "template": "Bắt đầu từ",
            "name": "Tên",
            "namePlaceholder": "VD: Trả lời câu hỏi thường gặp",
            "description": "Mô tả",
            "descriptionPlaceholder": "Luồng này làm gì?",
            "save": "Tạo",
            "saveFailed": "Không tạo được luồng",
            "created": "Đã tạo luồng",
            "categories": {"trigger": "Kích hoạt", "ai": "AI", "logic": "Logic", "apps": "Kết nối ứng dụng", "data": "Dữ liệu", "actions": "Hành động"},
            "builder": {"back": "Về danh sách luồng", "nameLabel": "Tên luồng", "statusLabel": "Trạng thái", "save": "Lưu", "saved": "Đã lưu luồng", "saveFailed": "Không lưu được luồng", "run": "Chạy", "runDisabled": "Chạy luồng cần engine, hiện chưa có.", "emptyTitle": "Hãy xây luồng đầu tiên của bạn", "emptyHint": "Luồng là chuỗi các bước tự động. Bắt đầu từ một mẫu, hoặc thêm bước từ bảng bên trái khi chúng được bổ sung.", "templatesTitle": "Bắt đầu từ mẫu", "startersTitle": "…hoặc bắt đầu bằng một trigger", "unknownNode": "Bước chưa đặt tên", "paletteSearch": "Tìm một bước…", "paletteNoMatch": "Không có bước nào khớp", "inspectorEmpty": "Chọn một bước để xem chi tiết.", "nodeName": "Tên bước", "nodeType": "Loại", "deleteNode": "Xoá bước", "noSettingsYet": "Bước này chưa có cài đặt.", "groupEmpty": "Chưa có bước nào"},
            "templates": {
                "blank": {
                    "name": "Luồng trống",
                    "description": "Bắt đầu từ canvas trống.",
                },
                "faq": {
                    "name": "Trả lời câu hỏi thường gặp",
                    "description": "Khi có tin nhắn đến, agent sẽ trả lời.",
                    "nodes": {
                        "trigger": "Khi có tin nhắn đến",
                        "agent": "Agent trả lời",
                    },
                },
                "alert": {
                    "name": "Báo khi có tin nhắn mới",
                    "description": "Khi có tin nhắn đến, gửi thông báo.",
                    "nodes": {
                        "trigger": "Khi có tin nhắn đến",
                        "notify": "Gửi thông báo",
                    },
                },
            },
        },
    },
}

INDENT = "  "


def assert_no_placeholders(node, where):
    """Components render numbers in JSX and never pass `count` to t()."""
    if isinstance(node, dict):
        for key, value in node.items():
            assert_no_placeholders(value, f"{where}.{key}")
    else:
        assert "{{" not in node, (where, node)


def block_for(key: str, value: dict, depth: int) -> str:
    """Render ``"key": {...}`` as indented JSON lines, no trailing comma."""
    pad = INDENT * depth
    inner = json.dumps(value, ensure_ascii=False, indent=2).splitlines()[1:-1]
    return "\n".join(
        [pad + json.dumps(key, ensure_ascii=False) + ": {"]
        + [pad + ln for ln in inner]
        + [pad + "}"]
    )


def replace_vi(path: pathlib.Path, text: str, nl: str) -> None:
    """vi.json is an overlay file: replace nav.flows and the whole flows group.

    json.loads/dumps(indent=2, ensure_ascii=False) round-trips this file byte for
    byte (checked), so only the replaced values change.
    """
    data = json.loads(text)
    data["nav"]["flows"] = COPY["vi"]["nav"]
    data["flows"] = COPY["vi"]["group"]
    out = json.dumps(data, ensure_ascii=False, indent=2) + ("\n" if text.endswith("\n") else "")
    if nl == "\r\n":
        out = out.replace("\n", "\r\n")
    path.write_bytes(out.encode("utf-8"))
    print(f"updated vi: {path}")


def flatten(node, prefix=""):
    if isinstance(node, dict):
        for key, value in node.items():
            yield from flatten(value, f"{prefix}.{key}" if prefix else key)
    else:
        yield prefix


KEY_CALL = re.compile(r"""\bt\(\s*["'](flows\.[A-Za-z0-9_.]+)["']""")


def check_keys() -> int:
    """Every static t("flows.*") key used under pages/Flows has copy in en, zh and vi."""
    pages = ROOT / "octop-orchester/src/dashboard/src/pages/Flows"
    used = set()
    for f in pages.rglob("*.ts*"):
        if ".test." in f.name:
            continue
        used |= set(KEY_CALL.findall(f.read_text(encoding="utf-8")))
    missing = []
    for lang, copy in COPY.items():
        have = {f"flows.{k}" for k in flatten(copy["group"])}
        have |= {f"flows.{k}" for k in copy["group"] if isinstance(copy["group"][k], dict)}
        missing += [(lang, key) for key in sorted(used) if key not in have]
    print(f"{len(used)} static keys checked; missing: {missing}")
    return 1 if missing else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="verify key coverage and exit")
    parser.add_argument(
        "--octop-dir",
        type=pathlib.Path,
        help="octop checkout (scratch worktree) whose dashboard en.json/zh.json to edit",
    )
    args = parser.parse_args()
    if args.check:
        return check_keys()
    if args.octop_dir is None:
        parser.error("--octop-dir is required unless --check is given")

    targets = {
        "en": args.octop_dir / "dashboard/src/locales/en.json",
        "zh": args.octop_dir / "dashboard/src/locales/zh.json",
        "vi": ROOT / "octop-orchester/src/dashboard/src/locales/vi.json",
    }

    for lang, copy in COPY.items():
        assert_no_placeholders(copy["group"], lang)

    for lang, path in targets.items():
        # Bytes, not text: upstream locale files may be CRLF and text mode would rewrite them.
        text = path.read_bytes().decode("utf-8")
        nl = "\r\n" if "\r\n" in text else "\n"
        has_group = '\n  "flows": {' in text.replace("\r\n", "\n")
        if lang == "vi":
            replace_vi(path, text, nl)
            continue
        if has_group:
            print(f"skip {lang}: already present (run against a worktree without the group)")
            continue
        text = text.replace("\r\n", "\n")
        data = json.loads(text)
        copy = COPY[lang]

        # nav.flows right after nav.orgChart; the label repeats in other nav
        # blocks, so scope the search to the first "nav": { block.
        nav_start = text.index('\n  "nav": {')
        nav_anchor = (
            f'\n    "orgChart": {json.dumps(data["nav"]["orgChart"], ensure_ascii=False)},'
        )
        hit = text.index(nav_anchor, nav_start)
        text = (
            text[: hit + len(nav_anchor)]
            + f'\n    "flows": {json.dumps(copy["nav"], ensure_ascii=False)},'
            + text[hit + len(nav_anchor) :]
        )

        # top-level flows group, right before "experts"
        top_anchor = '\n  "experts": {'
        assert text.count(top_anchor) == 1, (lang, "top anchor not unique")
        block = block_for("flows", copy["group"], depth=1)
        text = text.replace(top_anchor, "\n" + block + "," + top_anchor, 1)

        json.loads(text)  # must still parse
        if nl == "\r\n":
            text = text.replace("\n", "\r\n")
        path.write_bytes(text.encode("utf-8"))
        print(f"updated {lang}: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

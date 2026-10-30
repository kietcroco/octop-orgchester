# Kiến trúc — Webhook sự kiện agent (Webhook Event Feed)

| Dự án | Octop-Orchester |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-10-30 |
| Base | `octop/` @ `890111b7` (v0.9.16-824-g890111b7, tag v1.0.3b1) |
| Tham chiếu | [01-AGENCY-ARCHITECTURE.md](01-AGENCY-ARCHITECTURE.md), [02-ORGCHART-ARCHITECTURE.md](02-ORGCHART-ARCHITECTURE.md), [README](../README.md) |

## 1. Mục đích

Cho hệ thống bên ngoài (SIEM, kho log, ERP, hàng đợi nội bộ, dashboard riêng) **đăng ký một URL** và nhận **mọi sự kiện của agent** dưới dạng HTTP POST có ký, có retry, có nhật ký giao nhận — thay vì phải poll API hoặc đọc DB.

### Vị trí trên UI

| Chỗ xuất hiện | Đường dẫn | Component |
|---|---|---|
| Sidebar → **Cài đặt ứng dụng** (`nav.adminAdvanced`) → tab **Webhook** | `/admin/advanced?tab=webhooks` | `pages/Settings/Webhooks/index.tsx` |
| Bảng endpoint (badge số header, số pending/failed) | cùng tab | `WebhooksSettingsPanel` |
| Modal tạo/sửa — gồm khối "Header tuỳ chỉnh" | cùng tab | `Form.List` + `Input.Password` |
| Panel **Deliveries** (lọc status, retry thủ công) | cùng tab | `Table` |

Tab nằm trong **Cài đặt ứng dụng** vì đây là cấu hình hạ tầng, không phải chức năng người dùng cuối — xem §7 lý do không tách mục sidebar. Nhãn: `nav.webhooks` = "Webhook" ở cả ba ngôn ngữ. Quyền: tab dùng key `observability` có sẵn (`ADVANCED_TAB_PERMISSIONS.webhooks`), không thêm permission mới.

Sự kiện cần phủ:

| Người dùng yêu cầu | Nguồn trong Octop | Trạng thái |
|---|---|---|
| Bắt đầu conversation | `system` event (`turn_context.build_turn_start_chunks`) | **đã có** |
| Tìm / load skills | `context` event, `source="skills"` | **đã có** |
| Gọi tools | `tool` event, 2 pha `tool_call_chunk` → `tool_result`, có `call_id` | **đã có** |
| Response trả về | `assistant` event (merge theo request, có `_final`) | **đã có** |
| Context khác (MCP connector, memory file) | `context` event, `source="mcp"` / `memory` | **đã có** |
| Compaction | `compacted` event | **đã có** |
| **Giao sự kiện ra ngoài** | — | **thiếu — đây là phần sẽ thêm** |

Hai giới hạn có sẵn của upstream, cần biết trước để không hứa quá:

- **Không có sự kiện lỗi.** `projector._IGNORED_TYPES` bỏ `error`, `hitl_required`, `reasoning`, `usage`, `done`, `custom`, `slash_action`, `attachment`, `state_*`. Một chunk `type: "error"` **không** thành `TrajectoryEvent`, nên webhook không có gì để phát.
- **Cột `is_error` luôn `false`.** `projector._event()` khai báo tham số nhưng không call site nào truyền `is_error=True`; `_merge_tool` chỉ OR hai giá trị đều `false`. Cột tồn tại nhưng chưa có nguồn dữ liệu.

Envelope vẫn mang `is_error` đúng như sổ ghi. Muốn có sự kiện lỗi thật thì phải mở `_IGNORED_TYPES` (patch upstream) — xem §11.

Kết luận định hướng: **không xây lại sổ sự kiện.** Octop đã có một sổ append-only đầy đủ (`trajectory_events`) với `event_id` ổn định, `seq` đơn điệu, `turn_id`, `kind`, `is_error`, `summary`, `payload_json`. Việc còn lại thuần tuý là **lớp vận chuyển ra ngoài**: đăng ký endpoint, lọc, ký, retry, lưu vết.

Không áp dụng: định nghĩa lại event schema, thay projector, đổi SSE hiện có.

## 2. Kiến trúc

Một đường ống, ba khối. Khối ① và ② đã tồn tại — chỉ khối ③ là mới.

```
Harness chunk  (mọi nguồn: dashboard, IM, cron, team, HITL resume)
      │  AgentManager.stream() / resume_hitl()          ← điểm nghẽn duy nhất
      ▼
Gateway process/processor.py
      │  _observe_trajectory(chunk)
      ▼
① TrajectoryService.observe_chunk()
      │  project_harness_chunk()  →  TrajectoryEvent  (7 kind, seq, event_id)
      ├──────────────────────────────► ② TrajectoryLiveBus  →  SSE /trajectory/live  (đã có)
      │
      └──► _publish(event, final)   ← PATCH: thêm một dòng fan-out
              │
              ▼
     ③ WebhookSink.notify(event)                 (overlay, mới)
              │  lọc subscription → ghi outbox (webhook_delivery, status=pending)
              ▼
     Dispatcher (asyncio task, overlay, mới)
              │  claim pending → HMAC-SHA256 ký → POST httpx (đã là dependency)
              │  2xx → delivered │ 429/5xx/timeout → backoff │ 4xx → failed
              ▼
     Ngoài hệ thống: SIEM / log store / queue
```

Quyết định kiến trúc đáng ghi nhớ:

1. **Tap tại `TrajectoryService._publish`, không tap tại harness.** Chỗ này event đã được project, merge, cấp `seq` và `event_id` ổn định — webhook dùng luôn `event_id` làm khoá idempotency, không phải tự sinh.
2. **`_publish` được gọi nhiều lần cho cùng `event_id`.** Assistant ghép dần theo token, tool ghép call→result. Vì vậy patch truyền thêm một tham số `phase` (`started` / `delta` / `completed`) xuống sink, tách biệt khỏi cờ `final` của SSE — `final` chỉ đúng ở lần publish cuối của turn, còn `_finalize_assistant()` chốt nội dung assistant trước khi tool chạy mà vẫn để `final=False`. Không đổi ngữ nghĩa SSE.
3. **Outbox trước, HTTP sau.** `notify()` chỉ ghi DB (nhanh, không I/O mạng, không làm chậm stream). Dispatcher gửi sau. Server restart giữa chừng không mất sự kiện.
4. **Một dispatcher toàn cục, không một worker mỗi endpoint.** Một `asyncio.Task` duyệt outbox, giới hạn concurrency bằng `asyncio.Semaphore`. Ít bề mặt lỗi hơn N task.
5. **Không thêm permission key.** Dùng lại `observability` có sẵn → không phải sửa `infra/users/permissions.py`, không phải bump role mặc định.
6. **Không thêm patch migration.** Overlay migration 002 tự được nhặt vì patch `agency` đã gọi `run_overlay_migrations(db)` ở cả hai điểm boot (`server.py`). Đây là lý do overlay layer tồn tại.
7. **Payload mang cả thô lẫn chuẩn hoá.** `data` = `payload_json` gốc (chi tiết tool args/result), phần đầu envelope là các trường đã chuẩn hoá. Bên nhận lọc bằng envelope, đọc chi tiết trong `data`.
8. **Không đảm bảo đúng thứ tự giữa các endpoint.** Retry song song có thể vượt nhau. Bên nhận dùng `seq` (đơn điệu trong một thread) để tự sắp. Ghi rõ trong tài liệu tích hợp để không ai giả định FIFO.

### Vì sao cần patch, không chỉ config

Ladder của `INTRODUCTION.md` dừng ở đâu:

- **Settings/Config**: không có key nào bật webhook. `EPHEMERAL_PUSH_META.webhook_url` chỉ là metadata đẩy tạm của kênh IM, không phải event feed.
- **Public API**: đã có `GET /api/chat/threads/{id}/trajectory/events` + SSE `/trajectory/live` — **đủ cho consumer chủ động poll**. Nhưng không đáp ứng được "hệ thống khác nhận event" theo mô hình push, và SSE không retry được.
- **Plugin**: `PluginRegistry` chỉ có `kind: tool` và `kind: channel`. Không có `kind: hook`, không có seam nhận event. Muốn đi đường này phải mở rộng registry của harness — nhiều hơn cả một patch.
- **Patch**: hai patch nhỏ (service + app) là mức thấp nhất còn lại.

Điểm đã kiểm chứng: `grep -rn webhook src/` chỉ trả về `message_keys.py:71` (`webhook_url`), tức upstream không có webhook nào để tái dùng.

## 3. Cấu trúc folder

```
octop-orchester/
├── patches/                                        SỬA file upstream (7 patch)
│   ├── src/octop/infra/history/trajectory/service.py.webhook.patch   ← sink fan-out (9 hunk)
│   ├── src/octop/infra/server.py.webhook.patch                       ← gắn dispatcher lúc boot
│   ├── src/octop/api/app.py.webhook.patch                            ← import + mount
│   ├── dashboard/src/pages/Settings/AdvancedSettings/index.tsx.webhook.patch
│   ├── dashboard/src/utils/permissions.ts.webhook.patch
│   ├── dashboard/src/locales/en.json.webhook.patch
│   └── dashboard/src/locales/zh.json.webhook.patch
├── src/                                            FILE MỚI (không diff)
│   ├── src/octop/overlay/migrations/002_webhook.sql
│   ├── src/octop/overlay/migrations/002_webhook.pg.sql
│   ├── src/octop/overlay/webhook/__init__.py        export dispatcher + sink
│   ├── src/octop/overlay/webhook/store.py           CRUD endpoint + outbox (SQL thuần)
│   ├── src/octop/overlay/webhook/signing.py         hmac_sha256(), envelope(), _matches()
│   ├── src/octop/overlay/webhook/dispatcher.py      WebhookSink + WebhookDispatcher + backoff()
│   ├── src/octop/api/routers/webhooks.py            8 endpoint
│   ├── src/dashboard/src/api/modules/webhooks.ts    type + call
│   └── src/dashboard/src/pages/Settings/Webhooks/
│       ├── index.tsx                                bảng endpoint, form, log giao nhận, nút Test
│       └── index.module.less
└── scripts/
    ├── webhook_selfcheck.py                         assert hàm thuần + outbox (chạy trong image)
    ├── webhook_e2e.py                               chạy thật 14 event qua dispatcher + máy nhận HMAC
    ├── webhook_live_test.py                         chat thật của agent → 11 event tới máy nhận loopback
    └── webhook_receiver.py                          máy nhận thủ công trên host: in + ghi JSONL, kiểm HMAC
```

Số dòng thực tế: dispatcher 249, store 480, signing 146, router 309, trang dashboard 550, client 143, migration 44 (×2 dialect).

### Phase 2 (đóng lỗ hổng phủ cron + team) — tuỳ chọn

`CronDeliveryService._deliver_agent()` và `TeamManager` (dòng ~453, ~520) stream qua `AgentManager` nhưng **không gọi** `_observe_trajectory` → turn của cron và turn của team speaker hiện không vào `trajectory_events`, nên webhook cũng không thấy. Đây là hạn chế có sẵn của upstream, không phải do webhook. Đóng bằng 2 patch ~5 dòng mỗi chỗ, cùng khuôn với `processor._observe_trajectory`:

```python
# _deliver_agent(), trong vòng async for
self._trajectory.observe_chunk(command.agent_id, thread_id, chunk)
```

Nếu chưa cần, ghi rõ trong tài liệu tích hợp: "sự kiện cron/team chưa phát". Phase 1 vẫn phủ dashboard + IM (đường đi chính).

## 4. API

Router mount trong `app.py`:

```python
_RouterMount(webhooks.router, "/api/webhooks", ["webhooks"]),
```

Toàn bộ endpoint yêu cầu `Depends(require_permission("observability"))` — dùng lại key có sẵn. Tổng cộng **8** route:

| Method | Path | Việc |
|---|---|---|
| `GET` | `/api/webhooks` | danh sách endpoint + trạng thái sức khoẻ gần nhất |
| `POST` | `/api/webhooks` | tạo endpoint; trả `secret` **một lần duy nhất** |
| `PATCH` | `/api/webhooks/{endpoint_id}` | sửa `name`, `url`, `enabled`, bộ lọc, `headers` |
| `DELETE` | `/api/webhooks/{endpoint_id}` | xoá endpoint + delivery của nó (cascade) |
| `POST` | `/api/webhooks/{endpoint_id}/test` | gửi một event `ping` đồng bộ, trả `{ok, status, error}` |
| `POST` | `/api/webhooks/{endpoint_id}/rotate-secret` | sinh secret mới, trả một lần |
| `GET` | `/api/webhooks/{endpoint_id}/deliveries` | log giao nhận, `?status=&limit=&before_id=` |
| `POST` | `/api/webhooks/deliveries/{delivery_id}/retry` | đưa một delivery `failed` về `pending` |

Body / response:

```python
class EndpointBody(BaseModel):
    name: str = Field(max_length=64)
    url: str = Field(max_length=2048)        # chỉ http/https, chặn loopback ở tầng service
    enabled: bool = True
    types: list[str] = Field(default_factory=list)      # rỗng = mọi type (§11); "agent.tool.*" = wildcard
    agent_ids: list[str] = Field(default_factory=list)  # rỗng = mọi agent
    include_delta: bool = False              # True = gửi cả delta token của assistant
    headers: dict[str, str] = {}             # header tuỳ chỉnh, ghi một chiều (xem dưới)

class EndpointResponse(BaseModel):
    endpoint_id: str
    name: str
    url: str
    enabled: bool
    types: list[str]
    agent_ids: list[str]
    include_delta: bool
    secret_set: bool                          # secret không bao giờ trả lại
    header_names: list[str]                   # chỉ tên; giá trị không bao giờ trả lại
    created_at: int
    last_delivery_at: int | None
    last_status: str | None
    pending_count: int
    failed_count: int
```

`types` nhận các tên ở §11, hỗ trợ wildcard hậu tố `*` (`agent.tool.*`, `agent.skills.*`). Một tiêu chí lọc, không phải hai (`kinds` cũ bị bỏ để tránh hai bộ lọc chồng nhau).

### Header tuỳ chỉnh

Mỗi endpoint có thể khai báo thêm header gửi kèm **mọi** delivery — dùng cho bearer token, API key, hoặc header định tuyến mà hệ nhận yêu cầu.

| Khía cạnh | Hành vi |
|---|---|
| Lưu trữ | Giá trị được mã hoá Fernet và để trong bảng `secrets` khoá `webhook_headers:<endpoint_id>`, **không** nằm trong `webhook_endpoint` — cùng chỗ với signing secret |
| Trả về API | Chỉ `header_names`; giá trị ghi một chiều, không có endpoint đọc lại |
| PATCH | `headers` là **toàn bộ** tập tên mong muốn: tên vắng mặt bị xoá. Giá trị rỗng `""` nghĩa là giữ token đã lưu (form sửa không thể gửi lại giá trị nó không đọc được) |
| Kiểm tra | Tên theo ký tự token RFC 7230 (`[A-Za-z0-9!#$%&'*+.^_\`|~-]{1,64}`); không được trùng header Octop tự đặt; giá trị không chứa `\r`/`\n` (chặn header injection), ≤ 1024 ký tự, tối đa 16 header |
| Áp dụng | Gắn **sau** các header `X-Octop-*` trong cả dispatcher lẫn nút Test, nên token đến được hệ nhận ngay cả khi kiểm tra bằng Test |
| Xoá | Xoá endpoint xoá luôn bản ghi `webhook_headers:` trong `secrets` |

Không hỗ trợ header đọc từ biến môi trường hay tham chiếu secret khác — giá trị nhập trực tiếp, đã mã hoá khi lưu. Nếu cần nhiều bên nhận dùng chung một token, tạo endpoint riêng cho từng bên.

### Envelope gửi đi

```json
{
  "id": "trj_01J...",                 // = trajectory event_id → khoá idempotency
  "type": "agent.tool.completed",
  "phase": "completed",
  "occurred_at": 1767225600.412,
  "thread_id": "th_...",
  "agent_id": "ag_...",
  "seq": 42,
  "turn_id": "turn_...",
  "request_seq": 3,
  "is_error": false,
  "final": true,
  "summary": "web_fetch(https://example.com)",
  "data": { "call_id": "...", "name": "web_fetch", "args": {...}, "result": {...} }
}
```

Header:

| Header | Giá trị |
|---|---|
| `Content-Type` | `application/json` |
| `X-Octop-Event` | `type` (vd `agent.tool.completed`) |
| `X-Octop-Delivery` | `delivery_id` — bên nhận dedupe theo cái này khi retry |
| `X-Octop-Timestamp` | epoch giây |
| `X-Octop-Signature` | `sha256=<hex hmac_sha256(secret, timestamp + "." + raw_body)>` |
| *header tuỳ chỉnh* | Do người vận hành khai báo cho endpoint; gắn sau các header trên |

Ký trên `timestamp + "." + body` để chặn replay; bên nhận từ chối nếu lệch quá 300s.

### Hàm nội bộ

| Module | Hàm | Việc |
|---|---|---|
| `signing.py` | `sign(secret, ts, body) -> str` | HMAC-SHA256 hex, thuần, test được |
| | `event_type(event, phase) -> str` | §11: `kind` + `source` + `phase` → tên event |
| | `phase_of(event, *, is_new) -> str` | `started` / `delta` / `completed` |
| | `build_envelope(event, *, phase, final) -> dict` | `TrajectoryEvent` → envelope |
| | `matches(endpoint, type_) -> bool` | lọc `types` (kể cả wildcard) / `agent_ids` |
| `dispatcher.py` | `backoff_delay(attempt) -> float` | `min(10 * 4**(attempt-1), 3600)` |
| | `WebhookSink.notify(event, *, phase, final)` | gọi từ service; ném lỗi bị nuốt, chỉ log |
| | `WebhookDispatcher.start()` / `stop()` | task vòng lặp, claim batch 50, `Semaphore(8)` |
| | `WebhookDispatcher._deliver(row)` | POST httpx timeout 10s, phân loại kết quả |
| `store.py` | `list_endpoints` / `create` / `update` / `delete` | CRUD, secret qua `SecretRepo` + Fernet (khoá `webhook_secret:<endpoint_id>`) |
| | `set_headers` / `get_headers` / `header_names` | header tuỳ chỉnh, seal dưới khoá `webhook_headers:<endpoint_id>` |
| | `clean_headers(mapping) -> dict` | thuần, không I/O: từ chối tên không hợp lệ, header của Octop, `\r\n`, quá dài, quá nhiều |
| | `enqueue(endpoint_id, event, type_)` | `INSERT OR IGNORE` — UNIQUE tự chống trùng |
| | `claim_pending(limit)` | `UPDATE ... SET status='sending'` theo lô, atomic |
| | `mark_delivered` / `mark_retry` / `mark_failed` | cập nhật trạng thái + `next_attempt_at` |

Phân loại kết quả gửi:

| Kết quả | Hành động |
|---|---|
| 2xx | `delivered`, ghi `response_code` |
| 429 / 5xx / timeout / lỗi mạng | `pending`, `attempts += 1`, `next_attempt_at = now + backoff(attempts)` |
| 4xx khác (400/401/403/404/410) | `failed` — retry vô nghĩa, giữ row để người vận hành xem |
| `attempts >= 5` | `failed`, `last_error = "max attempts"` |

## 5. Schema (ERD)

Hai bảng, cả hai thuộc overlay (ledger riêng `_overlay_schema_version`, không đụng `_schema_version` của upstream).

```
┌──────────────────────────────────────────────────────────┐
│ webhook_endpoint                                          │
├──────────────────────────────────────────────────────────┤
│ id              INTEGER PK AUTOINCREMENT                  │
│ endpoint_id     TEXT UNIQUE NOT NULL      "wh_01J..."     │
│ name            TEXT NOT NULL                             │
│ url             TEXT NOT NULL                             │
│ enabled         INTEGER NOT NULL DEFAULT 1                │
│ types_json      TEXT NOT NULL DEFAULT '[]'                │
│ agent_ids_json  TEXT NOT NULL DEFAULT '[]'                │
│ include_delta   INTEGER NOT NULL DEFAULT 0                 │
│ created_by      INTEGER → users(id) ON DELETE SET NULL    │
│ created_at      INTEGER NOT NULL                          │
│ updated_at      INTEGER NOT NULL                          │
└────────────────────────┬─────────────────────────────────┘
                         │ 1
                         │
                         │ N        (ON DELETE CASCADE)
┌────────────────────────▼─────────────────────────────────┐
│ webhook_delivery            ← outbox, append-only         │
├──────────────────────────────────────────────────────────┤
│ id              INTEGER PK AUTOINCREMENT                  │
│ delivery_id     TEXT UNIQUE NOT NULL      "whd_01J..."    │
│ endpoint_id     TEXT NOT NULL  → webhook_endpoint         │
│                 (endpoint_id) ON DELETE CASCADE           │
│ event_id        TEXT NOT NULL   ← trajectory_events       │
│                 .event_id  (không FK: retention upstream  │
│                 xoá event cũ, outbox giữ nguyên payload)  │
│ thread_id       TEXT NOT NULL                             │
│ agent_id        TEXT NOT NULL                             │
│ kind            TEXT NOT NULL   ← TrajectoryKind          │
│ type            TEXT NOT NULL   ← tên event, vd agent.tool.completed
│ seq             INTEGER NOT NULL                          │
│ body_json       TEXT NOT NULL   ← envelope đã đóng băng   │
│ status          TEXT NOT NULL DEFAULT 'pending'           │
│                 CHECK IN ('pending','sending','delivered',│
│                          'failed')                        │
│ attempts        INTEGER NOT NULL DEFAULT 0                │
│ next_attempt_at REAL NOT NULL                             │
│ response_code   INTEGER                                   │
│ last_error      TEXT                                      │
│ created_at      INTEGER NOT NULL                          │
│ delivered_at    INTEGER                                   │
│ UNIQUE (endpoint_id, event_id, type)                      │
└──────────────────────────────────────────────────────────┘
```

Index:

```sql
CREATE INDEX IF NOT EXISTS idx_wh_delivery_due
  ON webhook_delivery (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_wh_delivery_endpoint
  ON webhook_delivery (endpoint_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_wh_delivery_event
  ON webhook_delivery (event_id);
```

Bất biến:

1. `UNIQUE (endpoint_id, event_id, type)` là toàn bộ cơ chế idempotency phía ghi — `INSERT OR IGNORE`, không cần kiểm tra trước. Có `type` trong khoá vì cùng một `event_id` sinh nhiều tên event theo pha (§11) — `agent.tool.started` rồi `agent.tool.completed` là hai row outbox, đúng như hai lần gửi.
2. `body_json` đóng băng payload lúc xếp hàng. Endpoint sửa bộ lọc về sau **không** làm thay đổi payload đã xếp hàng.
3. Không FK tới `trajectory_events`: upstream prune theo `TRAJECTORY_RETENTION_USER_TURNS`, một FK sẽ hoặc chặn prune hoặc xoá mất delivery chưa gửi.
4. Secret **không** nằm trong bảng. Lưu ở `SecretRepo` khoá `webhook_secret:<endpoint_id>`, mã hoá Fernet (tái dùng `seal_text`/`open_text`, `PURPOSE_SETTINGS`) — đúng khuôn `LangfuseSettingsStore` đang dùng.
5. `sending` là trạng thái tạm của claim. Lúc boot, dispatcher reset `sending` cũ hơn 5 phút về `pending` (crash recovery).

### Quan hệ với dữ liệu sẵn có

| Bảng dùng | Cột | Ai tạo |
|---|---|---|
| `trajectory_events` | `event_id, thread_id, agent_id, seq, kind, turn_id, is_error, summary, payload_json, ts` | upstream (đọc, không ghi) |
| `users` | `id` (FK `created_by`) | upstream |
| `secrets` | khoá `webhook_secret:*` | upstream (**ghi** qua `SecretRepo`) |

## 6. Migration

Hai file, cùng số 002:

- `src/src/octop/overlay/migrations/002_webhook.sql` — SQLite
- `src/src/octop/overlay/migrations/002_webhook.pg.sql` — PostgreSQL

**Không cần patch `server.py`.** Patch `agency` đã chèn `run_overlay_migrations(db)` ngay sau `run_migrations(db)` ở hai điểm (`start()` ~446, `bind_control_plane()` ~470). Thêm file 002 vào thư mục là đủ — `_discover()` tự nhặt, `_overlay_schema_version` tự tiến 1 → 2.

DDL viết `IF NOT EXISTS` toàn bộ, khớp quy ước 001. Khác biệt dialect chỉ ở: `INTEGER PRIMARY KEY AUTOINCREMENT` → `BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY` (đúng như 001), `REAL` → `DOUBLE PRECISION`, `CHECK (...)` giữ nguyên. Cột JSON vẫn là `TEXT` (không dùng `jsonb`) để hai dialect dùng chung một tầng Python.

Hệ quả: **patch `webhook` phụ thuộc patch `agency`** (overlay layer). Manifest phải ghi `applies_to`/`adds` đầy đủ để rebase không bỏ sót thứ tự.

## 7. Patch và file — danh sách đầy đủ

`patches/manifest.yaml` thêm một document `id: webhook`, `base_commit: 890111b7`.

| Patch | Anchor | Thay đổi |
|---|---|---|
| `src/octop/infra/history/trajectory/service.py` | `__init__`; `_publish()`; `_upsert()`; `finish_turn()`; 5 chỗ chốt nội dung (§11) | thêm `sinks` ctor + `self._sinks` + `_ThreadInFlight.seen` + `attach_sink()`; `_publish` nhận `phase`, gọi sink trong `suppress(Exception)`; 5 chỗ `_upsert` truyền `phase="completed"`. **Không đổi `final` → SSE y nguyên** |
| `src/octop/infra/server.py` | sau `trajectory_service = TrajectoryService(...)`; `start()` + `bind_control_plane()` | khởi tạo `WebhookStore` + dispatcher, gắn `WebhookSink` qua `attach_sink()`, `await dispatcher.start()` |
| `src/octop/api/app.py` | import routers; `_RouterMount` list | `webhooks` + `_RouterMount(webhooks.router, "/api/webhooks", ["webhooks"])` |
| `dashboard/src/pages/Settings/AdvancedSettings/index.tsx` | union tab key; `TABS`; `renderTab()` switch | thêm key `"webhooks"`, item `Webhook` icon, case render |
| `dashboard/src/utils/permissions.ts` | `ADVANCED_TAB_PERMISSIONS` | `webhooks: "observability"` (dùng lại key, không thêm permission) |
| `dashboard/src/locales/en.json`, `zh.json` | sau `"observability": {` | `nav.webhooks` + nhóm `webhook.*` (65 key/file: 1 `nav.webhooks` + 64 leaf, kể cả nhóm header tuỳ chỉnh) |

Hai patch *tuỳ chọn* chưa tồn tại (§3 "Phase 2") nếu muốn phủ thêm cron + team speaker: `src/octop/infra/cron/delivery.py` và `src/octop/infra/agents/teams/team_manager.py`.

**Kiểm lỗi thời.** `patches/lock.json` giữ sha256 upstream của 7 file tại `890111b7`; `scripts/patch_status.py` báo `STALE webhook` khi có file đã đổi. Danh sách đầy đủ: [00-PATCH-REGISTRY §4](00-PATCH-REGISTRY.md).

Patch nặng nhất bộ, và cũng dễ vỡ nhất khi upstream đổi: `src/octop/infra/history/trajectory/service.py` — 9 hunk, +45/−18, neo vào `__init__`, `_publish()`, `_upsert()`, `finish_turn()` và 5 chỗ chốt nội dung. Đây là điểm chèn **duy nhất** vào sổ sự kiện; nếu upstream đổi cách `_publish` gọi sink thì phải đọc lại §2 và §11 trước khi rebase, không chỉ ghép hunk cho khớp.

Wiring trong `server.py` — **cũng không cần patch** nếu dùng cách sau: dispatcher tự khởi động từ `webhooks.py` lần đầu router được gọi (`lifespan`-less, khởi tạo lazy trong `Depends`), và `WebhookSink` gắn vào service qua `attach_sink()` tại cùng chỗ. Nếu muốn khởi động ngay khi boot (không chờ request đầu), mới cần một patch `server.py` ~6 dòng sau `trajectory_service = TrajectoryService(...)`. Mặc định: **patch `server.py`**, vì outbox cần được drain kể cả khi không ai mở dashboard.

Trang dashboard Webhooks nằm trong tab **App settings** vì đây là cấu hình hạ tầng, không phải chức năng người dùng cuối. Nếu muốn đặt riêng một mục sidebar, xem thêm patch `sidebarNav`, `routes`, `prefetch`, `preferences.py` giống `org-chart` — nhưng đó là 4 patch nữa cho cùng một trang, không đáng.

Khoá i18n mới (65 key/file ở `en.json` + `zh.json` = `nav.webhooks` + 64 leaf; `vi.json` sửa trực tiếp):

```
nav.webhooks
webhook.title .desc .create .createTitle .editTitle
    .name .namePlaceholder .nameRequired .url .urlHint .urlRequired
    .types .typesHint .typesPlaceholder .agentIds .agentIdsHint .agentIdsPlaceholder
    .includeDelta .includeDeltaLabel .includeDeltaHint
    .headers .headersHint .addHeader .headerName .headerNameRequired
    .headerValuePlaceholder .headerCount
    .enabled .disabled .empty .emptyHint .pendingCount .failedCount .agentFilter
    .saved .created .saveFailed .deleted .deleteFailed .deleteConfirm .rotateConfirm
    .test .testSuccess .testFailed
    .deliveries .deliveriesTitle .statusFilter
    .colStatus .colType .colAgent .colThread .colAttempts .colResponse .colError
    .retry .retried
    .secretTitle .secretWarn .secretHint .copySecret .secretCopied .copyFailed
    .loadFailed
```

`check_parity.py` thêm `webhook.` vào `PATCH_ADDED_PREFIXES` và `nav.webhooks` vào `PATCH_ADDED_EXACT` để không báo extra. Nhóm `.headers` … `.headerCount` thuộc tính năng custom header (§4), thêm sau cùng — nếu rebase theo thứ tự cũ thì chúng nằm ở hunk thứ hai của patch locale.

`en.json`/`zh.json` qua patch; `vi.json` sửa trực tiếp; `check_parity.py` thêm `webhook.` vào `PATCH_ADDED_PREFIXES` và `nav.webhooks` vào `PATCH_ADDED_EXACT`.

## 8. Kiểm thử

| Mức | Lệnh | Kỳ vọng |
|---|---|---|
| Hàm thuần + outbox | `python octop-orchester/scripts/webhook_selfcheck.py` (**trong image** — cần `octop` import được) | `backoff_delay` = 10/40/160/640/3600; `sign()` khớp vector HMAC dựng tay; `matches()` lọc đúng types (kể cả wildcard)/agent_ids; `event_type()` khớp bảng §11; `build_envelope` khoá `id == event_id`; `validate_url` chặn loopback/private/link-local/non-http; `clean_headers` chặn tên trùng header của Octop, `\r\n`, quá dài, quá nhiều; header tuỳ chỉnh round-trip qua seal và bị xoá cùng endpoint; enqueue idempotent, claim/backoff/retry/stale-recovery/cascade |
| End-to-end từng event | `python octop-orchester/scripts/webhook_e2e.py` (trong image) | 14 loại event đi hết chuỗi chunk → projector → service(phase) → sink → outbox → dispatcher → POST → HMAC kiểm lại; in ra từng dòng `event / phase / seq` |
| Live end-to-end | `python octop-orchester/scripts/webhook_live_test.py` (trong image, cần agent thật) | tạo endpoint qua API công khai (đi qua `validate_url`), rồi chạy một lượt chat thật của agent: 11 loại event tới máy nhận, `id` = `event_id`, chữ ký HMAC khớp, outbox và máy nhận không lệch |
| Migration | `python octop-orchester/scripts/overlay_selfcheck.py` | 001 + 002 áp được, ledger = 2, chạy lại không đổi |
| API happy path | tạo endpoint → chat thử trong dashboard → `GET /deliveries` | `delivered`, `response_code=200`, envelope `id` = `event_id` của trajectory |
| Máy nhận thủ công | `python octop-orchester/scripts/webhook_receiver.py --secret whsec_...` rồi trỏ endpoint vào `http://host.docker.internal:9100/hook` | mỗi delivery in một dòng và ghi vào `webhook-received.jsonl`; `sig=ok` |
| Custom header | máy nhận chạy thêm `--expect 'Authorization: Bearer abc'` | dòng log ghi `"expect": "ok"`; gỡ header ở endpoint → `"bad: Authorization"`; file log không chứa giá trị token |
| Chữ ký | máy nhận kiểm `X-Octop-Signature` bằng secret | khớp; sửa 1 byte body → lệch |
| Khoá idempotency | cùng `(endpoint_id, event_id)` xếp hai lần cho hai `phase` khác nhau | 2 row, không bị `INSERT OR IGNORE` nuốt mất bản `completed` |
| Retry | trỏ endpoint vào URL trả 500 | `attempts` tăng, `next_attempt_at` giãn theo backoff; đổi sang 200 → `delivered` |
| 4xx cứng | endpoint trả 404 | `failed` ngay, không retry |
| Lọc | endpoint `types=["agent.tool.*"]` | chỉ nhận `agent.tool.started` + `agent.tool.completed` |
| Header tuỳ chỉnh | đặt `headers={"Authorization": "Bearer x"}` rồi bấm Test | máy nhận thấy header, giá trị đúng; `GET /api/webhooks` chỉ trả `header_names` |
| Build | `docker compose build 2>&1 \| grep -E "applying\|FAILED:"` | mọi patch áp, 0 `FAILED` — **submodule `octop/` phải sạch**, xem ghi chú dưới |
| i18n | `python octop-orchester/scripts/vi-i18n/check_parity.py` | `missing 0 \| extra 0` |
| Baseline | `git -C octop status --short` | rỗng |

**`octop/` phải sạch trước khi build.** `octop-base` build thẳng từ submodule, nên nếu ở đó còn bản sửa tay thì mỗi patch bị áp hai lần và build dừng ở `patch does not apply`. Patch trong `octop-orchester/patches/` là nguồn duy nhất.

**`webhook_e2e.py` phải chạy trong image**, không chạy được bằng Python 3.10 local (repo dùng generic PEP 695):

```bash
docker cp octop-orchester/scripts/webhook_e2e.py octop-orchester:/tmp/
docker exec octop-orchester python /tmp/webhook_e2e.py
```

**`webhook_live_test.py`** chạy với server đang sống và một agent thật (`OCTOP_TEST_AGENT`, mặc định `WH-expert`), cần mật khẩu admin:

```bash
docker cp octop-orchester/scripts/webhook_live_test.py octop-orchester:/tmp/
docker exec -e OCTOP_PW="$OCTOP_DEFAULT_PASSWORD" octop-orchester python /tmp/webhook_live_test.py
```

Nó tạo endpoint qua `POST /api/webhooks` (để `validate_url` thật sự chạy), sau đó **đổi URL trong DB sang một máy nhận loopback trong container** — đây là chỗ duy nhất test đi vòng qua chốt SSRF, và chỉ vì máy nhận nằm cùng container. Phần còn lại đúng đường production: sink → outbox → dispatcher → POST có chữ ký. `agent.message.delta` không được assert vì nó chỉ xuất hiện khi hai token cách nhau hơn 50 ms; `agent.connectors.loaded` và `agent.context.compacted` cần MCP server / thread bị nén, nên thuộc phạm vi của `webhook_e2e.py`.

**`webhook_receiver.py`** là máy nhận để bạn tự cấu hình và test từ dashboard — chạy trên host, không cần Docker:

```bash
python octop-orchester/scripts/webhook_receiver.py --port 9100 --log webhook-received.jsonl --secret whsec_...
```

Rồi tạo endpoint với URL `http://host.docker.internal:9100/hook`. `host.docker.internal` trỏ vào địa chỉ private của host, nên mặc định `validate_url` sẽ từ chối — phải khai báo host đó trong `OCTOP_WEBHOOK_ALLOW_HOSTS` (compose đã truyền biến này; `.env` mẫu đặt sẵn `host.docker.internal`). Đây là bật ở mức triển khai, không phải cờ theo từng endpoint, nên người dùng dashboard không tự nới chốt SSRF được. Bỏ biến đi là chốt trở lại nghiêm ngặt.

Script in mỗi delivery thành một dòng (`event`, `phase`, `seq`, `agent`, `sig`) và ghi nối vào file JSONL. `sig=ok` nghĩa là `X-Octop-Signature` khớp secret bạn truyền vào `--secret`; không truyền thì ghi `sig=-`.

Để kiểm custom header mà không ghi token ra đĩa, truyền `--expect` (lặp lại được):

```bash
python octop-orchester/scripts/webhook_receiver.py \
  --secret whsec_... --expect 'Authorization: Bearer abc' --expect 'X-Api-Key: k-123'
```

Log chỉ ghi **tên** header và kết quả so sánh (`"expect": "ok"` / `"bad: X-Api-Key"`), không ghi giá trị — còn dòng in ra terminal cũng thêm `ok` hoặc `bad: ...`.

## 9. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Endpoint bên nhận chậm/chết làm phình outbox | `Semaphore(8)` + timeout 10s + `failed` sau 5 lần; thêm job dọn delivery `delivered` cũ hơn 30 ngày (đặt trong cron có sẵn) |
| SSRF: endpoint trỏ vào `169.254.169.254` / `localhost` | Chỉ nhận `http`/`https`; resolve host và chặn loopback/link-local/private ở tầng service; không cho redirect (`follow_redirects=False`). Ngoại lệ duy nhất là `OCTOP_WEBHOOK_ALLOW_HOSTS` (danh sách host khai báo lúc deploy, không phải cờ per-endpoint) — dùng để trỏ endpoint vào máy nhận trên máy của chính người vận hành. **Lưu ý khi sửa:** `_BlockedTarget` kế thừa `ValueError`, nên không được đặt lời gọi nó trong `suppress(ValueError)` — làm vậy sẽ nuốt luôn chốt chặn. `check_validate_url()` trong `webhook_selfcheck.py` giữ đúng hành vi này, kể cả phần allowlist |
| Secret lộ qua log / response API | Không bao giờ trả lại `secret`; chỉ trả `secret_set: bool`. Ghi secret vào `SecretRepo` (Fernet), không vào bảng |
| Token trong header tuỳ chỉnh lộ ra ngoài | Giá trị được seal như signing secret, không nằm trong bảng endpoint; API chỉ trả `header_names`; không log header khi gửi; kiểm tra tên/giá trị để chặn header injection (`clean_headers`) |
| Sink ném lỗi làm chậm hoặc vỡ stream chat | `notify()` bọc `try/except` toàn bộ, chỉ log; đây là ràng buộc cứng vì nó chạy trong `_publish` |
| Retry vượt thứ tự → bên nhận xử lý sai | Envelope có `seq`; tài liệu tích hợp ghi rõ "sắp theo `seq`, không theo thời điểm nhận" |
| `assistant` phát nhiều bản dở dang | Mặc định chỉ gửi `agent.message.completed`; `include_delta=true` mới gửi `agent.message.delta`, khi đó bên nhận dedupe theo `id` + `phase` |
| Retention upstream xoá `trajectory_events` | `body_json` đã đóng băng; không FK sang bảng event |
| Patch `service.py` lệch khi nâng base | Patch chỉ 1 tham số ctor + 2 dòng trong `_publish`; dễ đọc lại và áp tay |
| Dispatcher giữ task khi test | `start()`/`stop()` idempotent; selfcheck chạy dispatcher một vòng rồi `stop()` |

## 10. Tiêu chí hoàn thành

1. Tạo endpoint trong tab App settings → dán URL nhận → nhận được `agent.webhook.test`.
2. Một turn chat thật sinh ra đúng chuỗi ở §11.3: `agent.conversation.started`, `agent.context.*`, `agent.message.received`, `agent.tool.started` + `agent.tool.completed`, `agent.message.completed`.
3. Mọi request có `X-Octop-Signature` hợp lệ; secret chỉ hiện một lần lúc tạo/rotate.
4. Tắt endpoint → không còn delivery mới; bật lại → tiếp tục.
5. Endpoint trả 500 → thấy `attempts` tăng và `next_attempt_at` giãn; `POST .../retry` đưa về hàng đợi.
6. Lọc `types` / `agent_ids` đúng; không lộ sự kiện của agent ngoài bộ lọc. `include_delta=false` (mặc định) không sinh `agent.*.delta`.
7. Server restart giữa lúc đang retry → delivery vẫn còn và tự gửi tiếp (không mất, không nhân đôi).
8. `webhook_selfcheck.py` pass, `overlay_selfcheck.py` pass tới ledger 2.
9. Build 0 `FAILED`; `git -C octop status --short` rỗng; `check_parity.py` → `missing 0 | extra 0`.

## 11. Danh sách event

Tên event có dạng `agent.<nhóm>.<hành động>`. Ba trường quyết định tên: `kind` (từ projector), `payload.source` (với `context`), và pha publish.

**Quy tắc pha.** `_publish()` được gọi nhiều lần cho cùng một `event_id` khi nội dung được ghép dần (assistant theo token, tool theo call→result). Patch truyền xuống sink một `phase`:

| `phase` | Nghĩa | Có gửi mặc định |
|---|---|---|
| `started` | lần ghi đầu của `event_id` | có |
| `delta` | lần gộp tiếp theo, nội dung còn thay đổi | **không** — chỉ khi `include_delta=true` |
| `completed` | lần ghi cuối, nội dung chốt | có |

Cờ `_final` của SSE **không dùng lại được**: nó chỉ bật ở `finish_turn()` (cuối turn), trong khi nội dung đã chốt sớm hơn — `_finalize_assistant()` chốt khối trả lời trước khi tool chạy, `_observe_tool()` chốt tool khi `tool_result` về. Gán `final=True` ở những chỗ đó sẽ **đổi hành vi SSE**. Vì vậy patch thêm một tham số `phase` song song, không đụng `final`:

```python
# service.py — chữ ký mới
def _upsert(self, event, *, final: bool = False, phase: str | None = None) -> None:
    if self._store.upsert(event):
        self._metrics_cache.pop(event.thread_id, None)
        self._publish(event, final=final, phase=phase)

def _publish(self, event, *, final: bool = False, phase: str | None = None) -> None:
    message = asdict(event)
    if final:
        message["_final"] = True          # SSE: giữ nguyên
    self._bus.publish(event.thread_id, message)
    if self._sinks:
        state = self._inflight.setdefault(event.thread_id, _ThreadInFlight())
        resolved = phase or ("started" if event.event_id not in state.seen else "delta")
        state.seen.add(event.event_id)
        for sink in self._sinks:
            with suppress(Exception):
                sink(event, phase=resolved)
```

`seen: set[str]` là trường mới trên `_ThreadInFlight`, xoá cùng chỗ `finish_turn()` đã xoá `assistant`/`tools` — không phình bộ nhớ.

Mọi chỗ chốt nội dung truyền `phase="completed"` — kể cả hai nhánh trong `finish_turn()` đã có `final=True`, vì `phase` không suy ra từ `final`:

| Chỗ | Hiện tại | Patch |
|---|---|---|
| `_observe_tool()`, nhánh merge có `tool_result` | `self._upsert(merged)` | `self._upsert(merged, phase="completed")` |
| `_finalize_assistant()` | `self._upsert(stamped)` | `self._upsert(stamped, phase="completed")` |
| `finish_turn()` — chốt khối assistant cuối | `self._upsert(_stamp_llm_duration(assistant), final=True)` | thêm `phase="completed"` |
| `finish_turn()` — gắn `usage` vào `usage_target` | `self._upsert(target, final=True)` | thêm `phase="completed"` |
| `finish_turn()` — flush tool còn dở | `self._upsert(tool)` | `self._upsert(tool, phase="completed")` |

`_commit_new()` có thêm tham số `phase`, mặc định `"completed"`:

| Gọi từ | `phase` | Vì sao |
|---|---|---|
| `observe_chunk()` nhánh else (`user`, `system`, `context`, `compacted`) | `completed` (mặc định) | sự kiện một lần, ghi xong là chốt |
| `_observe_assistant()` — khối trả lời mới | `started` | còn ghép token |
| `_observe_tool()` — `call_id` mới | `started` | còn chờ `tool_result` |
| `_observe_tool()` — `_tool_call_only_parent` | `started` | dòng tổng hợp, có thể nhận `usage` sau |

`_publish_partial()` để `None` → `delta` (và `include_delta=false` chặn tại sink).

### 11.1 Bảng đầy đủ

| Event type | `kind` | Pha | Khi nào phát | `data` có |
|---|---|---|---|---|
| `agent.conversation.started` | `system` | `completed` | Mỗi thread, **lần đầu** có turn (guard `has_kind(thread_id,"system")` chặn lặp) | `label="Initial System Prompt"`, `content` |
| `agent.context.memory` | `context` | `completed` | Mỗi turn, một event cho mỗi file memory tồn tại trong workspace. `label` là **tên file**, không phải đường dẫn | `source="memory"`, `label=<tên file>` |
| `agent.skills.loaded` | `context` | `completed` | Mỗi turn, sau khi lọc allow-list. **Không phát** nếu danh sách rỗng và turn không có bộ lọc tường minh | `source="skills"`, `label="Available skills"`, `content` = danh sách `- <skill>` hoặc `(none)` |
| `agent.connectors.loaded` | `context` | `completed` | Mỗi turn, nếu agent có MCP server | `source="mcp"`, `label="Connectors"`, `content` |
| `agent.message.received` | `user` | `completed` | Tin người dùng vào thread | `content`, `source` = `dashboard` / `cli` / loại kênh IM |
| `agent.message.started` | `assistant` | `started` | Token đầu tiên của một khối trả lời | `node`, `content` |
| `agent.message.delta` | `assistant` | `delta` | Chỉ khi `include_delta=true`. Mỗi lần gộp token, throttle 50ms (`_LIVE_UPDATE_INTERVAL_S`) | `node`, `content` tích luỹ |
| `agent.message.completed` | `assistant` | `completed` | Khối trả lời được chốt — khi sang tool, sang request mới, hoặc hết turn | `node`, `content`, `tool_duration_ms`; `usage` nếu là khối cuối turn |
| `agent.message.tool_only` | `assistant` | `started` | Model gọi tool khi chưa nói gì → dòng tổng hợp `tool_call_only` do service tự chèn, đóng vai khung chứa `usage` của turn | `tool_call_only: true`, `content=""` |
| `agent.tool.started` | `tool` | `started` | Chunk `tool_call_chunk` đầu tiên của `call_id` | `call_id`, `name`, `args` |
| `agent.tool.delta` | `tool` | `delta` | Chỉ khi `include_delta=true`. `tool_call_chunk` tiếp theo cùng `call_id` (args còn chảy về) | `call_id`, `name`, `args` tích luỹ |
| `agent.tool.completed` | `tool` | `completed` | Chunk `tool_result` cùng `call_id` | `call_id`, `name`, `args`, `result`, `tool_duration_ms` |
| `agent.context.compacted` | `compacted` | `completed` | Harness nén lịch sử | `summarized_count`, `preserved_count`, `removed_tokens`, `summary`, `file_path?` |
| `agent.webhook.test` | — | — | Nút Test trong dashboard, không đi qua sổ sự kiện | `{ping: true}` |

`agent.unknown.*` không phát — projector trả `[]` cho chunk lạ.

### 11.2 Ánh xạ ngược: yêu cầu → event

| Người dùng nói | Event nhận được |
|---|---|
| bắt đầu conversation | `agent.conversation.started` (một lần/thread) |
| tìm skills | *không có event riêng* — việc tìm skill là tool call, tới dưới dạng `agent.tool.started` với `name` là tên tool skill |
| load skills | `agent.skills.loaded` (danh sách skill được nạp cho turn) |
| gọi tools | `agent.tool.started` → `agent.tool.completed` (cặp, cùng `call_id`) |
| response về | `agent.message.completed` (và `agent.message.delta` nếu bật) |
| tất cả event | để `types` rỗng |

### 11.3 Một turn điển hình

Chat "đọc trang này giúp tôi", agent dùng skill `web-fetch`:

```
seq  event_id                     type                        phase
 1   th:1:system                  agent.conversation.started  completed   ← chỉ turn đầu thread
 2   th:2:context                 agent.context.memory        completed   ← MEMORY.md
 3   th:3:context                 agent.context.memory        completed   ← USER.md
 4   th:4:context                 agent.skills.loaded         completed
 5   th:5:context                 agent.connectors.loaded     completed
 6   th:6:user                    agent.message.received      completed
 7   th:7:assistant:tool_call_only agent.message.tool_only    started     ← model gọi tool, chưa nói gì
 8   th:8:tool:tc_1               agent.tool.started          started     name=web_fetch
     th:8:tool:tc_1               agent.tool.delta            delta       ← chỉ khi include_delta
 9   th:8:tool:tc_1               agent.tool.completed        completed   result=…
10   th:10:assistant              agent.message.started       started
     th:10:assistant              agent.message.delta         delta       ← chỉ khi include_delta
11   th:10:assistant              agent.message.completed     completed
```

Điểm cần nhớ khi viết bên nhận: **cùng một `event_id` xuất hiện nhiều lần** với `phase` khác nhau. Khoá idempotency đầy đủ là `(id, phase)`. Upsert theo `id` (bản `completed` ghi đè), hoặc chỉ lưu bản `completed`.

Turn sau trong cùng thread: `agent.conversation.started` biến mất (một lần/thread); chuỗi `context.*` phát lại mỗi turn vì đó là ngữ cảnh nạp cho turn ấy.

### 11.4 Không có event cho

| Trường hợp | Vì sao | Cách xử lý nếu bắt buộc cần |
|---|---|---|
| Lỗi harness / lỗi tool | `_IGNORED_TYPES` bỏ `error` | patch `projector.py`: bỏ `"error"` khỏi tập bỏ, map sang `agent.error` (phase 2). Lưu ý: `error` chunk **không có** `call_id`, nên không gắn được vào tool đã phát — bên nhận phải ghép theo `turn_id` + thời điểm |
| Yêu cầu phê duyệt tool (HITL) | `_IGNORED_TYPES` bỏ `hitl_required` | cùng cách, `agent.approval.required`, kèm `data.request` đã `normalize_hitl_request` (phase 2) |
| Token usage | chunk `usage` bị bỏ, nhưng **usage được gộp vào `agent.message.completed`** khi `finish_turn(usage=…)` | đọc `data.usage` của event cuối turn |
| Bắt đầu/kết thúc thread, xoá thread | không có chunk tương ứng | cần hook riêng ở tầng thread registry (phase 3) |
| Cron, team speaker | không đi qua `_observe_trajectory` | phase 2 (§3) |
| Suy luận của model (`reasoning`) | `_IGNORED_TYPES` bỏ, tránh lộ chain-of-thought | không nên mở |

Trường `is_error` trong envelope luôn `false` (xem §1) — đừng thiết kế bên nhận dựa vào nó.


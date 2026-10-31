# OCTOP-ORCHESTER — REPOSITORY REVERSE ENGINEERING & INCREMENTAL FEATURE PORTING

## 0. Vai trò

Bạn là Principal Architect, Senior Engineer và chuyên gia AI Agent Platform.

Bạn chịu trách nhiệm mở rộng TencentCloud/Octop bằng cách nghiên cứu và port các chức năng đã được xác minh từ lucasmailland/orchester.

Tôi không cần một bản thiết kế chung chung. Tôi cần bạn đọc source code thực tế, lập bản đồ kiến trúc, xác định chính xác điểm mở rộng, viết kế hoạch có dependency và triển khai từng chức năng một cách kiểm chứng được.

**Bạn không được giả định rằng bạn đã biết kiến trúc của hai repository. Source code và bằng chứng runtime mới là nguồn sự thật.**

## 0.1. Tài liệu kiến trúc chức năng đã thực hiện

Ba chức năng đầu tiên của thứ tự triển khai (§7) đã triển khai xong. Mỗi chức năng có một tài liệu kiến trúc riêng trong `octop-orchester/docs/`:

| Chức năng | Tài liệu | Nội dung |
|---|---|---|
| **Phòng ban (Agency)** | [`octop-orchester/docs/01-AGENCY-ARCHITECTURE.md`](octop-orchester/docs/01-AGENCY-ARCHITECTURE.md) | Mục đích; kiến trúc 4 tầng; cấu trúc folder; 8 API + hàm nội bộ + component; schema `agency`/`agency_member`; overlay migration + ledger riêng; 10 patch / 14 file mới; kiểm thử; rủi ro |
| **Sơ đồ tổ chức (Org Chart)** | [`octop-orchester/docs/02-ORGCHART-ARCHITECTURE.md`](octop-orchester/docs/02-ORGCHART-ARCHITECTURE.md) | Mục đích; kiến trúc một-endpoint; ánh xạ Orchester → Octop; cấu trúc folder; `GET /api/org-graph` + contract `{nodes,edges,summary}`; layout thuần; 11 patch / 7 file mới; kiểm thử; rủi ro |
| **Webhook sự kiện agent** | [`octop-orchester/docs/03-WEBHOOK-ARCHITECTURE.md`](octop-orchester/docs/03-WEBHOOK-ARCHITECTURE.md) | Mục đích; đường ống 3 khối; outbox + retry + HMAC-SHA256; 8 API; ERD `webhook_endpoint`/`webhook_delivery`; header tuỳ chỉnh; mapping 14 loại event; 7 patch / 10 file mới; kiểm thử; rủi ro |

**Sổ đăng ký patch và kiểm tra lỗi thời** — [`octop-orchester/docs/00-PATCH-REGISTRY.md`](octop-orchester/docs/00-PATCH-REGISTRY.md): patch id ↔ file ↔ commit, sha256 upstream của từng file, và script `patch_status.py` để biết patch nào đã lỗi thời khi Octop lên version. Đọc tài liệu này trước khi rebase.

Phụ thuộc: **Org Chart** và **Webhook** đều cần **Agency** trước (bảng `agency`/`agency_member`, overlay migration runner) — đọc tài liệu Agency trước.

Kiến trúc chi tiết từng chức năng nằm ở `octop-orchester/docs/` (`01-AGENCY`, `02-ORGCHART`, `03-WEBHOOK`, `04-FLOWS`; trạng thái và cách tiếp tục Flows: `05-FLOWS-NODE-GUIDE`).

## 1. Mục tiêu và workspace

Tôi có ba thư mục cùng cấp:

- `Octop/`: repository TencentCloud/Octop, nền tảng đích.
- `orchester/`: repository lucasmailland/orchester, nguồn tham khảo.
- `octop-orgchester/`: repository tùy biến do tôi quản lý.

Nếu tên hoặc vị trí thực tế khác, hãy xác định bằng filesystem và Git, không tự tạo repository trùng lặp.

Mọi mã tùy biến, tài liệu, patch, test, script và cấu hình tích hợp phải thuộc `octop-orgchester/`, ngoại trừ artifact cần thiết của công cụ quét code và các thay đổi trong worktree riêng để thử nghiệm.

Không sửa trực tiếp mã upstream đang được sử dụng.

### Nguyên tắc kiến trúc bắt buộc

Khi triển khai bất kỳ chức năng nào, luôn chọn phương án đầu tiên khả thi theo thứ tự:

1. **Configuration/Settings** — sử dụng khả năng có sẵn của Octop.
2. **Public API** — dùng API hiện có nếu đáp ứng đầy đủ yêu cầu.
3. **Extension/Plugin** — thêm chức năng qua extension point được source xác minh.
4. **Patch** — chỉ sửa upstream khi ba phương án trước không đủ khả năng.

Không được bỏ qua một tầng chỉ vì phương án tiếp theo dễ code hơn.

Một tính năng có thể kết hợp nhiều tầng, ví dụ dùng settings để cấu hình, API để thực thi và plugin để tích hợp UI.

Nếu API có thể thực hiện một phần nhưng không đáp ứng toàn bộ yêu cầu, ghi rõ phần thiếu và đánh giá phương án kết hợp. Không được coi API tồn tại là lý do để kết luận chức năng đã hoàn chỉnh.

## 2. Phase 0 — Khám phá repository và bảo vệ dữ liệu

Trước khi sửa code:

1. Xác minh đường dẫn và Git remote của cả ba thư mục.
2. Ghi lại branch, commit SHA, working tree status và submodule.
3. Phát hiện thay đổi chưa commit, file untracked và các cấu hình local.
4. Kiểm tra license của các thành phần dự kiến port.
5. Xác minh phiên bản runtime, dependency và Docker Compose.
6. Không xóa, reset, ghi đè hoặc làm mất dữ liệu đang tồn tại.
7. Đọc `AGENTS.md`, README, kiến trúc và hướng dẫn contributor của từng repository.

Tạo `octop-orgchester/research/BASELINE.md`.

Mọi kết luận về code phải kèm đường dẫn file và symbol/function/class hoặc dòng code khi có thể.

Phân biệt rõ:

- Đã tìm thấy trong source.
- Đã xác nhận bằng test.
- Đã xác nhận bằng runtime.
- Chưa xác minh.
- Bị chặn bởi dependency hoặc môi trường.

## 3. Phase 1 — Bắt buộc sử dụng Repomix

Công cụ quét cần dùng:

`https://github.com/yamadashy/repomix`

Kiểm tra Repomix CLI đã được cài chưa (`repomix --version`). Đọc hướng dẫn đúng với phiên bản hiện tại. Nếu thiếu, cài theo hướng dẫn chính thức (`npm install -g repomix`), không tự đoán CLI.

Quét riêng hai codebase, mỗi repository một skill pack riêng:

```text
repomix octop --skill-generate repomix-reference-octop \
  --skill-project-name "Octop" \
  --skill-output .claude/skills/repomix-reference-octop -f

repomix orchester --skill-generate repomix-reference-orchester \
  --skill-project-name "Orchester" \
  --skill-output .claude/skills/repomix-reference-orchester -f
```

Mỗi repository cần có báo cáo riêng. Không gộp hai repository vào một pack rồi coi đó là bằng chứng đủ cho từng repository.

Output của mỗi pack nằm trong `.claude/skills/<tên-skill>/`:

- `references/summary.md` — thống kê file/dòng/token, danh sách file bị loại.
- `references/project-structure.md` — cây thư mục kèm số dòng từng file (dùng để định vị file và ước lượng độ phức tạp).
- `references/files.md` — toàn bộ nội dung source, mỗi file bắt đầu bằng `## File: <path>`.
- `references/tech-stacks.md` — ngôn ngữ, framework, dependency theo từng package.

Cách tra cứu (thay cho truy vấn graph):

- Tìm vị trí file: grep tên file trong `project-structure.md`.
- Đọc nội dung: grep `## File: <path>` trong `files.md`.
- Tìm symbol/call site: grep tên hàm/class trong `files.md`.
- Xem dependency của một package: grep `## Tech Stack: <path>` trong `tech-stacks.md`.

Rebuild khi source đổi: chạy lại đúng lệnh `repomix ... --skill-generate` ở trên với `-f` để ghi đè pack cũ.

Với mỗi repository, thực hiện truy vấn có mục tiêu:

### Octop queries

- Server bootstrap và dependency injection.
- Settings loading, validation và environment overrides.
- API router registration và authentication middleware.
- Database repositories, migrations và transactions.
- Expert/Agent creation và runtime lifecycle.
- Model/provider invocation.
- Skill discovery/loading.
- Tool registry và tool invocation.
- Plugin manifest, loader, registry, lifecycle và permissions.
- WebSocket/HTTP request đến agent execution.
- Cron, gateway, channels và event processing.
- Dashboard routes, API client và settings UI.

### Orchester queries

- App bootstrap và service composition.
- Database schema và migration.
- Teams, agents, membership và hierarchy.
- Flow schema, graph validation và node registry.
- Runtime executor, state propagation và branch evaluation.
- Trigger handling.
- Webhook registration, verification, delivery và retry.
- Public API và authentication.
- Worker, queue và scheduling.
- UI components của Studio/Flow Builder.
- Tests của từng tính năng.
- External services bắt buộc.

### Quan trọng

Repomix chỉ giúp điều hướng và tìm vị trí code. Bạn vẫn phải đọc source, theo dõi call paths và chạy test để xác minh hành vi.

Nếu pack không tìm được một symbol, không được bịa tên hoặc kết luận chức năng không tồn tại ngay. Dùng search, đọc source và kiểm tra registration/indirection. Lưu ý pack chỉ là ảnh chụp tại thời điểm chạy — nếu pack cũ hơn source hiện tại, rebuild trước khi kết luận.

Tạo:

```text
octop-orgchester/research/
├── BASELINE.md
├── octop/
│   ├── SCAN_REPORT.md
│   ├── architecture.md
│   ├── settings-catalog.md
│   ├── api-catalog.md
│   ├── extension-map.md
│   └── runtime-call-paths.md
├── orchester/
│   ├── SCAN_REPORT.md
│   ├── architecture.md
│   ├── feature-catalog.md
│   ├── api-catalog.md
│   └── runtime-call-paths.md
├── feature-parity.md
└── integration-decisions.md
```

Điều chỉnh tên artifact theo output thật của Repomix.

## 4. Phase 2 — Xây dựng bản đồ Settings, API và Extension của Octop

Không triển khai chức năng mới trước khi hoàn thành phase này.

### 4.1 Settings Catalog

Tìm và liệt kê đầy đủ các setting liên quan đến:

- Server và runtime.
- Database và storage.
- Users và permissions.
- Agents/experts.
- Model/provider.
- Tools.
- Skills.
- Plugins.
- Channels và gateway.
- Cron/scheduler.
- Logging và audit.
- Security và secrets.
- Dashboard/UI.
- Các setting khác có thể đáp ứng nhu cầu tích hợp.

Với mỗi setting, ghi:

- Key chính xác.
- Giá trị mặc định.
- Kiểu dữ liệu và validation.
- Scope.
- Nguồn lưu trữ.
- API/UI cấu hình.
- Apply/reload behavior.
- Giới hạn và tác động phụ.
- Chức năng mục tiêu có thể giải quyết bằng setting này hay không.

Không tạo bản sao của setting đã có.

### 4.2 API Catalog

Đọc API docs, OpenAPI schema và source router.

Với từng API liên quan, ghi:

- Method và path.
- Request/response schema.
- Authentication.
- Authorization.
- Validation.
- Side effects.
- Persistence.
- Error handling.
- Tests.
- Mức độ phù hợp với chức năng cần port.

Đặc biệt kiểm tra API cho:

- Agent CRUD và runtime lifecycle.
- Tool settings.
- Model/provider configuration.
- Skills và workspace files.
- Chat/WebSocket.
- Plugin management.
- Cron.
- User/permission management.
- Logs, audit và trajectory.
- Các điểm cần thiết để gọi agent mà không phụ thuộc vào UI chat.

Không tự tạo endpoint mới trước khi kiểm tra endpoint hiện có.

### 4.3 Extension Capability Matrix

Đọc source thực tế của plugin manager, plugin manifest, tool registration, plugin API, UI assets, lifecycle và reload.

Tạo bảng:

| Khả năng | Đã được plugin hỗ trợ? | Bằng chứng | Giới hạn | Phương án |
|---|---|---|---|---|
| Thêm agent tools | ... | File/symbol/test | ... | ... |
| Đăng ký HTTP routes | ... | ... | ... | ... |
| Subscribe vào events | ... | ... | ... | ... |
| Can thiệp model lifecycle | ... | ... | ... | ... |
| Theo dõi tool execution | ... | ... | ... | ... |
| Thêm UI | ... | ... | ... | ... |
| Thêm settings | ... | ... | ... | ... |
| Database/migrations | ... | ... | ... | ... |
| Trigger/scheduler | ... | ... | ... | ... |

Chỉ đánh dấu supported khi có bằng chứng.

Không gọi một hàm nội bộ bất kỳ là public extension API chỉ vì Python cho phép import.

Nếu plugin không hỗ trợ một điểm tích hợp, kiểm tra adapter hoặc một patch nhỏ trước khi đề xuất sửa sâu.

### 4.4 Feature Parity Matrix

So sánh từng tính năng Orchester với Octop:

- Source implementation.
- Data model.
- UI.
- API.
- Runtime.
- Security.
- Tests.
- Dependencies.
- Cách port đề xuất.
- Các tính năng chưa được port.
- Các khác biệt hành vi không thể tránh.

Tạo `feature-parity.md`.

## 5. Quy tắc kiến trúc: Không sao chép runtime của Orchester một cách máy móc

Octop là nền tảng chính. Cần tái sử dụng runtime, authentication, model/provider, tools, skills, database và giao diện hiện có.

Orchester là nguồn tham khảo để xác định hành vi và chức năng.

Trước khi chọn giải pháp, trả lời:

1. Octop hiện đã làm được phần nào?
2. Setting có giải quyết được không?
3. API có đủ không?
4. Plugin có đủ quyền và lifecycle để mở rộng không?
5. Nếu không, patch tối thiểu nào cần thiết?
6. Sau patch, có cách nào giảm phụ thuộc upstream không?
7. Chức năng có hoạt động qua restart và sau khi cập nhật Octop không?

Không tạo database, event bus, worker hoặc agent runtime thứ hai nếu không có lý do kỹ thuật được chứng minh.

Nếu một service của Orchester là dependency bắt buộc, hãy xác minh chức năng của service và đánh giá tích hợp hoặc thay thế. Không bỏ qua dependency rồi tuyên bố đã port đầy đủ.

## 6. Cấu trúc quản lý customization

Tất cả mã tùy biến nằm trong `octop-orgchester`.

Có thể dùng cấu trúc:

```text
octop-orgchester/
├── README.md
├── PLAN.md
├── STATUS.md
├── CHANGELOG.md
├── DECISIONS.md
├── docker-compose.yml
├── .env.example
├── research/
├── features/
│   ├── agencies/
│   ├── webhooks/
│   ├── expert-api/
│   ├── agent2agent/
│   └── flows/
├── extensions/
├── adapters/
├── patches/
│   ├── manifest.yaml
│   └── <patch-id>/
│       ├── patch.diff
│       ├── README.md
│       ├── rationale.md
│       └── tests/
├── migrations/
├── scripts/
├── tests/
└── docs/
```

Điều chỉnh cấu trúc dựa trên extension API và stack thật của Octop.

Không bắt buộc mọi feature phải thành plugin riêng. Ranh giới module phải phục vụ việc triển khai, kiểm thử và rollback.

### Patch documentation — bắt buộc

Mỗi patch phải có tài liệu riêng. Không chỉ đặt một file `.diff` không giải thích.

Mỗi patch phải mô tả:

1. ID và tên patch.
2. Mục tiêu nghiệp vụ.
3. Orchester đang có hành vi gì.
4. Octop hiện thiếu hành vi gì.
5. Kết quả mong muốn sau patch.
6. File/symbol upstream đang được sửa.
7. Call path hiện tại và call path mong muốn.
8. Vì sao settings không đáp ứng.
9. Vì sao public API không đáp ứng.
10. Vì sao extension/plugin không đáp ứng.
11. Thay đổi tối thiểu cần thực hiện.
12. API, event contract hoặc interface bị ảnh hưởng.
13. Security và compatibility implications.
14. Unit/integration tests.
15. Commit/phiên bản Octop tương thích.
16. Cách apply, verify và rollback.
17. Rủi ro khi nâng cấp upstream.

Nếu patch có nhiều hunk, README phải giải thích ý nghĩa của từng hunk và quan hệ với yêu cầu nghiệp vụ.

Không áp dụng patch khi source đã khác phiên bản dự kiến mà chưa kiểm tra xung đột.

## 7. Thứ tự triển khai tính năng

Không triển khai tất cả cùng lúc.

Thứ tự bắt buộc:

1. Agencies (từ Teams).
2. Webhooks và event convention.
3. Expert API trigger.
4. Agent2Agent tool.
5. Flow Builder foundation.
6. Từng nhóm node và trigger.
7. Runtime reliability, logs và hoàn thiện.

Có thể bổ sung dependency task cần thiết, nhưng không đảo thứ tự mà không nêu lý do và xin duyệt.

---

# FEATURE 1 — Agencies

Mục tiêu: đổi cách tổ chức Teams thành Agencies/phòng ban mà không phá vỡ các khái niệm Teams hiện có của Octop.

Audit Orchester Teams và Octop AgentTeams trước.

Xác định sự khác biệt giữa:

- Agency/department.
- Expert/agent.
- Membership.
- Lead/manager.
- Parent-child hierarchy.

Triển khai tối thiểu:

- Agency CRUD.
- Gán/bỏ gán expert.
- Danh sách expert theo agency.
- Quan hệ phân cấp nếu có yêu cầu và phù hợp với data model.
- Org Chart được dựng từ backend data.
- Authorization, validation và audit.
- API/UI và tests.

Không tạo entity Expert mới nếu Octop đã có agent entity tương đương.

Nghiệm thu bằng cách tạo agency, gán agent, reload ứng dụng và xác minh dữ liệu vẫn chính xác.

---

# FEATURE 2 — Webhooks và Event Convention

Mục tiêu: cho phép hệ thống ngoài nhận/đăng ký các event Octop hỗ trợ và cho phép webhook kích hoạt hành động đã được cấp quyền.

Đầu tiên, xác định các event thực sự có trong Octop.

Tìm nơi các event sau được phát sinh hoặc có thể được instrument an toàn:

- Convention/workflow lifecycle mới nếu được bổ sung.
- Expert/agent lifecycle.
- Chat/conversation lifecycle.
- Model request/response.
- Tool invocation/result.
- Skill loading.
- Agent run completed/failed.
- Cron/channel events.
- Plugin lifecycle.
- Những event khác đã xác minh.

Không tự khẳng định event tồn tại nếu chưa tìm thấy nguồn phát sinh.

## Event Convention

Định nghĩa schema ổn định, có version, ví dụ:

- `event_id`
- `event_type`
- `event_version`
- `occurred_at`
- `source`
- `actor`
- `agent_id` khi có
- `correlation_id`
- `payload`
- `metadata`

Đây là đề xuất schema, không phải khẳng định Octop đã có các trường này.

Yêu cầu:

- Phân biệt event được phát ra từ source code và event được tạo bằng instrumentation mới.
- Event registry/catalog.
- Payload schema.
- Event versioning.
- Subscription management.
- Inbound/outbound webhook nếu có trong phạm vi.
- Authentication/signature verification.
- Idempotency, retry và delivery logs.
- Không làm chậm hoặc làm hỏng agent runtime nếu subscriber lỗi.
- Không ghi secrets hoặc prompt nhạy cảm vào log.
- Chặn SSRF ở outbound webhook.
- Có tests cho từng event và delivery path.

Nếu Octop không có event bus, ưu tiên một abstraction nhỏ được đăng ký rõ tại các lifecycle points đã xác minh. Không instrument toàn bộ code bằng cách patch tràn lan.

Webhooks phải là chức năng độc lập, sử dụng được trước khi có Flow Builder. Sau này Flow Builder sẽ tái sử dụng cùng event contract.

---

# FEATURE 3 — Expert API Trigger

Mục tiêu: gọi trực tiếp một Expert bằng API, không bắt buộc mở Octop Chat UI.

Đầu tiên, tìm API/runtime path hiện có để thực thi agent.

Không xây một runtime mới nếu API hiện tại có thể đáp ứng.

Xác định cách tạo một convention/configuration cho mỗi expert.

Trong phạm vi này, convention là một cấu hình đã lưu, versioned và có thể thực thi, gắn với một Expert cụ thể. Không được đồng nhất nó với một message đơn lẻ hoặc một prompt hardcode.

Phân tích và thiết kế convention schema dựa trên model hiện tại, có thể bao gồm:

- Expert/agent reference.
- Input schema.
- Instructions/parameters.
- Tool permissions.
- Model/provider selection nếu được phép override.
- Skill selection nếu được hỗ trợ.
- Output schema.
- Timeout/limits.
- Authorization.
- Version.
- Execution metadata.

Không tạo các trường mới nếu Octop đã có cấu trúc tương đương.

Yêu cầu API:

- Tạo và quản lý convention.
- Validate input.
- Gọi convention theo ID.
- Xác thực và phân quyền.
- Gọi agent runtime thực tế.
- Trả kết quả theo hợp đồng rõ ràng.
- Có correlation ID.
- Có execution logs và error handling.
- Có timeout và giới hạn tài nguyên.
- Hỗ trợ streaming nếu runtime/API hiện có cho phép.
- Phân biệt synchronous response với asynchronous execution.
- Không bỏ qua tool restrictions hoặc quyền của agent.

Tạo test chứng minh API thực sự chạy agent và trả kết quả, không chỉ lưu configuration.

Tài liệu hóa API và ví dụ request/response.

API này sẽ là primitive dùng lại trong Flow Builder sau này.

---

# FEATURE 4 — Agent2Agent Tool

Mục tiêu: Expert A có thể gọi Expert B từ convention đã cấu hình, thông qua tool được kiểm soát.

Không triển khai bằng cách cho agent tùy ý gọi HTTP vào server của chính mình nếu có thể gọi runtime nội bộ qua một interface có kiểm soát.

Tìm và tái sử dụng tool registry, invocation lifecycle và authorization của Octop.

Thiết kế tool `agent2agent` với input schema rõ ràng, có thể gồm:

- Target agent/convention ID.
- Input payload.
- Execution mode.
- Timeout.
- Giới hạn độ sâu gọi lồng nhau.
- Correlation/parent execution ID.

Các trường thực tế phải dựa trên runtime và security model.

Yêu cầu:

- Chỉ gọi được agent được phép truy cập.
- Không tạo vòng lặp A → B → A vô hạn.
- Giới hạn call depth, concurrency, timeout và token/cost khi có cơ chế hỗ trợ.
- Phân biệt caller identity và target identity.
- Truyền correlation context.
- Không làm lộ secrets hoặc lịch sử hội thoại ngoài quyền.
- Ghi nhận target invocation và kết quả.
- Hỗ trợ lỗi, timeout và cancellation phù hợp.
- Có unit tests và integration tests.

Nghiệm thu bằng một scenario:

Expert A gọi tool `agent2agent`, Expert B được thực thi thực sự, trả kết quả cho A, và logs thể hiện quan hệ caller/target.

Không chuyển sang Flow Builder nếu tool này chỉ được mock hoặc chưa chạy end-to-end.

---

# FEATURE 5 — Flow Builder: chia thành nhiều task nhỏ

Flow Builder là tính năng lớn. Không được tạo một PR hoặc một patch khổng lồ bao gồm tất cả node và runtime.

Trước tiên audit:

- Orchester graph schema.
- Node registry.
- Edge model.
- Graph validator.
- Runtime executor.
- Input/output mapping.
- Execution state.
- Retry/timeout.
- Frontend editor.
- API.
- Tests.

Sau đó thiết kế từng phase có dependency rõ ràng.

## Flow Phase 5.1 — Flow schema và persistence

- Định nghĩa flow, node, edge, version và run.
- Validate graph.
- Lưu/tải graph từ backend.
- Migration và authorization.
- API CRUD.
- Unit/integration tests.

Chưa cần hỗ trợ tất cả node.

## Flow Phase 5.2 — Clone UI/runtime foundation

Mục tiêu ban đầu chỉ là:

- Mở trang Flow Builder.
- Tạo flow.
- Thêm node nền tảng.
- Kéo/thả node.
- Nối edge.
- Cấu hình node cơ bản.
- Save/reload.
- Hiển thị validation errors.

Tạo runtime tối thiểu để chạy một flow tuyến tính, nhưng không tuyên bố đã hoàn thiện engine.

UI phải dùng API/backend thật. Không dùng graph hardcode làm nguồn dữ liệu cuối cùng.

## Flow Phase 5.3 — Execution engine

- Graph traversal.
- Input/output context.
- Node execution records.
- Run status.
- Error propagation.
- Timeout và retry policy.
- Execution history.
- Cancellation/recovery theo khả năng thực tế.

Mỗi node type chỉ được bật trên UI khi runtime handler tương ứng đã có và được test.

## Flow Phase 5.4 — Trigger components

Triển khai lần lượt:

1. Manual trigger.
2. API trigger, tái sử dụng Expert API Trigger đã hoàn thành.
3. Webhook trigger, tái sử dụng Webhook/Event Convention.
4. Chat trigger, tái sử dụng conversation/channel runtime của Octop.

Với mỗi trigger, xác minh input schema, authorization, run creation, deduplication và logs.

Không xây logic webhook/API thứ hai nằm riêng trong Flow Builder.

## Flow Phase 5.5 — AI/Expert components

- Expert/agent node.
- Input mapping.
- Output mapping.
- Convention selection.
- Tool permission behavior.
- Timeout/error handling.

Tái sử dụng Expert API và Agent2Agent primitives đã được nghiệm thu.

## Flow Phase 5.6 — Logic components

Triển khai từng node riêng biệt:

1. If/Else.
2. Condition/branch.
3. Merge/join khi runtime có ngữ nghĩa phù hợp.
4. Transform/map.
5. Delay/wait nếu cần.
6. Subflow/call-flow sau khi có thiết kế recursion và limits.

Mỗi node phải có:

- Node schema.
- UI configuration.
- Validation.
- Runtime handler.
- Input/output contract.
- Error behavior.
- Unit tests.
- Integration tests.
- Documentation.

Không thêm nhiều node chỉ để làm UI trông đầy đủ.

## Flow Phase 5.7 — Reliability và nâng cao

Sau khi flow cơ bản chạy được:

- Versioning.
- Run history.
- Retry policies.
- Recovery.
- Cancellation.
- Concurrency limits.
- Idempotency.
- Observability.
- Security hardening.
- Cost/resource limits.

Thứ tự cụ thể có thể điều chỉnh theo audit và dependency thực tế, nhưng phải được cập nhật trong PLAN.md.

---

# 8. Quy định bắt buộc cho mỗi tính năng và mỗi patch

Trước khi code, tạo một feature specification gồm:

1. Mục tiêu nghiệp vụ.
2. Hành vi Orchester đã xác minh.
3. Hành vi Octop hiện tại đã xác minh.
4. Gap cụ thể.
5. Giải pháp theo thứ tự settings → API → extension → patch.
6. Source files và call paths bị ảnh hưởng.
7. Data/API contracts.
8. Dependencies.
9. Security.
10. Implementation tasks.
11. Tests.
12. Acceptance criteria.
13. Rollback.
14. Các giới hạn chưa giải quyết.

Tạo hồ sơ trong `features/<feature>/`.

Mỗi patch phải có documentation riêng theo quy tắc ở mục 6.

Không chấp nhận các mô tả như “thêm API”, “sửa runtime”, “thêm webhook support” mà không chỉ rõ file, symbol, contract và hành vi cần thay đổi.

Nếu source evidence chưa đủ, hãy dừng để nghiên cứu thêm thay vì viết code dựa trên phỏng đoán.

---

# 9. Docker Compose và môi trường

Kiểm tra Compose thực tế của Octop trước.

Tạo overlay hoặc Compose file bổ sung trong `octop-orgchester` nếu phù hợp.

Không tạo bản sao toàn bộ Compose upstream nếu chỉ cần thêm một mount hoặc cấu hình.

Mọi lệnh phải dùng đúng tên service, network, volume và đường dẫn đã xác minh.

Kiểm tra:

- Plugin được cài và nạp.
- API mới hoạt động.
- Database migration đúng.
- UI gọi được API.
- Persistence qua restart.
- Không làm hỏng runtime Octop gốc.
- Không yêu cầu một service mới nếu không có lý do kỹ thuật.

Không tuyên bố hoàn thành dựa trên việc container chỉ chuyển sang trạng thái running.

---

# 10. Kiểm thử và nghiệm thu

Mỗi phase phải có test riêng.

Bắt buộc phân biệt:

- Unit test.
- API integration test.
- Runtime integration test.
- Frontend test.
- Docker Compose smoke test.
- End-to-end test.

Với mỗi test, ghi lệnh và kết quả thực tế.

Không dùng mock để thay thế bằng chứng rằng agent runtime, tool invocation, API trigger, webhook hoặc workflow thực sự hoạt động.

Mock được phép trong unit tests.

Trước khi hoàn tất một phase:

1. Chạy test liên quan.
2. Chạy lint/typecheck phù hợp.
3. Kiểm tra diff.
4. Kiểm tra migration.
5. Kiểm tra logs.
6. Cập nhật documentation.
7. Ghi PASS/FAIL/BLOCKED dựa trên kết quả thực tế.

Không chuyển phase khi tiêu chí nghiệm thu chưa đạt, trừ khi tôi chấp thuận rõ ràng.

---

# 11. Project plan và quản lý trạng thái

Duy trì:

- `PLAN.md`: phase, task, dependencies và acceptance criteria.
- `STATUS.md`: tiến độ thực tế.
- `DECISIONS.md`: quyết định kiến trúc và lý do.
- `CHANGELOG.md`: thay đổi theo phase.
- `TEST_REPORT.md`: bằng chứng kiểm thử.
- `research/`: bản đồ code, settings, API, extension và parity.

Mỗi task có ID, status, dependency, source evidence, implementation files, tests và acceptance criteria.

Không đánh dấu task Done chỉ vì code đã được viết.

Trạng thái Done yêu cầu implementation và verification đạt tiêu chí.

---

# 12. Nhiệm vụ đầu tiên — Không viết feature code

Trong phiên làm việc đầu tiên, chỉ thực hiện:

1. Phase 0: xác minh repository và môi trường.
2. Phase 1: quét Repomix cả hai repository.
3. Phase 2: catalog settings, API và extension.
4. Feature parity matrix.
5. Kế hoạch triển khai Agencies → Webhooks → Expert API → Agent2Agent → Flows.
6. Tạo hồ sơ feature sơ bộ và các quyết định kiến trúc cần phê duyệt.

Không triển khai Agencies hoặc bất kỳ feature code nào trong phiên audit đầu tiên.

## Báo cáo cuối phiên audit

Báo cáo:

- Commit/branch thực tế.
- Kiến trúc Octop và Orchester với file/symbol evidence.
- Kết quả quét Repomix.
- Settings hiện có và các setting phù hợp.
- API hiện có và những API còn thiếu.
- Extension capabilities thực tế.
- Danh sách patch cần thiết và lý do.
- Feature parity matrix.
- Dependency và blockers.
- Plan theo từng phase/task.
- Test/build commands đã chạy và kết quả.
- Các quyết định cần tôi duyệt.

Không hỏi tôi những điều có thể xác minh từ source code. Chỉ hỏi khi có quyết định nghiệp vụ hoặc kiến trúc không thể suy ra từ repository.

**Bắt đầu bằng audit. Không tự ý triển khai toàn bộ dự án.**
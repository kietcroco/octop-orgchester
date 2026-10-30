import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { message } from "@/utils/antdMessage";
import {
  CheckCircle2,
  Copy,
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Trash2,
  Webhook,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { TabPanelHeader } from "../AdvancedSettings/TabPanelHeader";
import {
  ALL_EVENT_TYPES,
  WEBHOOK_EVENT_TYPES,
  webhooksApi,
  type DeliveryStatus,
  type WebhookDelivery,
  type WebhookEndpoint,
  type WebhookWriteBody,
} from "../../../api/modules/webhooks";
import styles from "./index.module.less";

const { Text, Paragraph } = Typography;

const STATUS_COLOR: Record<DeliveryStatus, string> = {
  pending: "gold",
  sending: "blue",
  delivered: "green",
  failed: "red",
};

/** Webhook endpoint management — embeddable in Advanced Settings tab. */

/** Form rows for headers are `{name, value}` pairs; the API wants a name -> value map. */
type WebhookFormValues = Omit<WebhookWriteBody, "headers"> & {
  headers?: { name?: string; value?: string }[];
};

export function WebhooksSettingsPanel() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WebhookEndpoint | null>(null);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<WebhookEndpoint | null>(null);
  const [form] = Form.useForm<WebhookFormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await webhooksApi.list());
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("webhook.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      types: [],
      agent_ids: [],
      include_delta: false,
      headers: [],
    });
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (row: WebhookEndpoint) => {
    form.setFieldsValue({
      name: row.name,
      url: row.url,
      enabled: row.enabled,
      types: row.types,
      agent_ids: row.agent_ids,
      include_delta: row.include_delta,
      // Values stay blank: the server holds the tokens and never returns them.
      // Leaving a value blank on save keeps the stored token.
      headers: row.header_names.map((name) => ({ name, value: "" })),
    });
    setEditing(row);
    setCreating(true);
  };

  const handleSubmit = async () => {
    let values: WebhookFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const { headers: headerRows, ...rest } = values;
    const body: WebhookWriteBody = {
      ...rest,
      headers: Object.fromEntries(
        (headerRows ?? [])
          .filter((h) => (h?.name ?? "").trim())
          .map((h) => [(h.name ?? "").trim(), h.value ?? ""]),
      ),
    };
    try {
      if (editing) {
        await webhooksApi.update(editing.endpoint_id, body);
        message.success(t("webhook.saved"));
      } else {
        const created = await webhooksApi.create(body);
        setSecret(created.secret);
        message.success(t("webhook.created"));
      }
      setCreating(false);
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : t("webhook.saveFailed"));
    }
  };

  const handleToggle = async (row: WebhookEndpoint, enabled: boolean) => {
    try {
      await webhooksApi.update(row.endpoint_id, { enabled });
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : t("webhook.saveFailed"));
    }
  };

  const handleTest = async (row: WebhookEndpoint) => {
    try {
      const result = await webhooksApi.test(row.endpoint_id);
      if (result.ok) {
        message.success(t("webhook.testSuccess", { status: result.status }));
      } else {
        message.error(
          result.error || t("webhook.testFailed", { status: result.status }),
        );
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : t("webhook.testFailed", { status: "" }));
    }
  };

  const handleRotate = async (row: WebhookEndpoint) => {
    try {
      const result = await webhooksApi.rotateSecret(row.endpoint_id);
      setSecret(result.secret);
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : t("webhook.saveFailed"));
    }
  };

  const handleDelete = async (row: WebhookEndpoint) => {
    try {
      await webhooksApi.remove(row.endpoint_id);
      message.success(t("webhook.deleted"));
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : t("webhook.deleteFailed"));
    }
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      message.success(t("webhook.secretCopied"));
    } catch {
      message.error(t("webhook.copyFailed"));
    }
  };

  return (
    <div className={styles.panel}>
      <TabPanelHeader
        icon={<Webhook size={22} />}
        title={t("webhook.title")}
        description={t("webhook.desc")}
        actions={
          <Space>
            <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>
              {t("common.refresh")}
            </Button>
            <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
              {t("webhook.create")}
            </Button>
          </Space>
        }
      />

      {!loading && rows.length === 0 ? (
        <Alert type="info" showIcon message={t("webhook.empty")} description={t("webhook.emptyHint")} />
      ) : (
        <div className={styles.endpointList}>
          {rows.map((row) => (
            <div key={row.endpoint_id} className={styles.endpointRow}>
              <div className={styles.endpointBody}>
                <div className={styles.endpointHead}>
                  <span className={styles.endpointName}>{row.name}</span>
                  <Tag color={row.enabled ? "green" : "default"}>
                    {row.enabled ? t("webhook.enabled") : t("webhook.disabled")}
                  </Tag>
                  {row.failed_count > 0 ? (
                    <Tag color="red">
                      {t("webhook.failedCount", { count: row.failed_count })}
                    </Tag>
                  ) : null}
                  {row.pending_count > 0 ? (
                    <Tag color="gold">
                      {t("webhook.pendingCount", { count: row.pending_count })}
                    </Tag>
                  ) : null}
                </div>
                <div className={styles.endpointUrl}>{row.url}</div>
                <div className={styles.tagRow}>
                  {(row.types.length ? row.types : ["*"]).map((type) => (
                    <Tag key={type}>{type}</Tag>
                  ))}
                  {row.include_delta ? (
                    <Tag color="blue">{t("webhook.includeDelta")}</Tag>
                  ) : null}
                  {row.header_names.length ? (
                    <Tag color="geekblue">
                      {t("webhook.headerCount", { count: row.header_names.length })}
                    </Tag>
                  ) : null}
                  {row.agent_ids.length ? (
                    <Tag color="purple">
                      {t("webhook.agentFilter", { count: row.agent_ids.length })}
                    </Tag>
                  ) : null}
                </div>
              </div>
              <div className={styles.endpointActions}>
                <Switch
                  checked={row.enabled}
                  onChange={(checked) => void handleToggle(row, checked)}
                  aria-label={t("webhook.enabled")}
                />
                <Button
                  size="small"
                  icon={<Send size={14} />}
                  onClick={() => void handleTest(row)}
                >
                  {t("webhook.test")}
                </Button>
                <Button
                  size="small"
                  icon={<History size={14} />}
                  onClick={() => setHistoryFor(row)}
                >
                  {t("webhook.deliveries")}
                </Button>
                <Button size="small" onClick={() => openEdit(row)}>
                  {t("common.edit")}
                </Button>
                <Popconfirm
                  title={t("webhook.rotateConfirm")}
                  onConfirm={() => void handleRotate(row)}
                >
                  <Button size="small" icon={<RotateCcw size={14} />} />
                </Popconfirm>
                <Popconfirm
                  title={t("webhook.deleteConfirm")}
                  onConfirm={() => void handleDelete(row)}
                >
                  <Button size="small" danger icon={<Trash2 size={14} />} />
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={creating}
        title={editing ? t("webhook.editTitle") : t("webhook.createTitle")}
        onCancel={() => setCreating(false)}
        onOk={() => void handleSubmit()}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t("webhook.name")}
            rules={[{ required: true, message: t("webhook.nameRequired") }]}
          >
            <Input placeholder={t("webhook.namePlaceholder")} maxLength={64} />
          </Form.Item>
          <Form.Item
            name="url"
            label={t("webhook.url")}
            extra={t("webhook.urlHint")}
            rules={[{ required: true, message: t("webhook.urlRequired") }]}
          >
            <Input placeholder="https://example.com/hooks/octop" maxLength={2048} />
          </Form.Item>
          <Form.Item name="types" label={t("webhook.types")} extra={t("webhook.typesHint")}>
            <Select
              mode="tags"
              allowClear
              placeholder={t("webhook.typesPlaceholder")}
              options={WEBHOOK_EVENT_TYPES.map((group) => ({
                label: group.group,
                options: group.types.map((type) => ({ label: type, value: type })),
              }))}
            />
          </Form.Item>
          <Form.Item name="agent_ids" label={t("webhook.agentIds")} extra={t("webhook.agentIdsHint")}>
            <Select mode="tags" allowClear placeholder={t("webhook.agentIdsPlaceholder")} />
          </Form.Item>
          <Form.Item
            name="include_delta"
            label={t("webhook.includeDeltaLabel")}
            extra={t("webhook.includeDeltaHint")}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item name="enabled" label={t("webhook.enabled")} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            label={t("webhook.headers")}
            extra={t("webhook.headersHint")}
          >
            <Form.List name="headers">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="baseline" style={{ display: "flex" }}>
                      <Form.Item
                        name={[field.name, "name"]}
                        rules={[{ required: true, message: t("webhook.headerNameRequired") }]}
                        style={{ marginBottom: 8 }}
                      >
                        <Input placeholder="Authorization" maxLength={64} style={{ width: 200 }} />
                      </Form.Item>
                      <Form.Item name={[field.name, "value"]} style={{ marginBottom: 8 }}>
                        <Input.Password
                          placeholder={t("webhook.headerValuePlaceholder")}
                          maxLength={1024}
                          style={{ width: 300 }}
                        />
                      </Form.Item>
                      <Button type="text" danger onClick={() => remove(field.name)}>
                        {t("common.delete")}
                      </Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ name: "", value: "" })} block>
                    {t("webhook.addHeader")}
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={secret !== null}
        title={t("webhook.secretTitle")}
        onCancel={() => setSecret(null)}
        footer={
          <Space>
            <Button icon={<Copy size={14} />} onClick={() => void copySecret()}>
              {t("webhook.copySecret")}
            </Button>
            <Button type="primary" onClick={() => setSecret(null)}>
              {t("common.done")}
            </Button>
          </Space>
        }
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t("webhook.secretWarn")}
        />
        <Paragraph className={styles.secretBox} copyable={{ text: secret ?? "" }}>
          <Text code>{secret}</Text>
        </Paragraph>
        <Text type="secondary">
          <CheckCircle2 size={12} style={{ marginRight: 4 }} />
          {t("webhook.secretHint")}
        </Text>
      </Modal>

      <DeliveryDrawer
        endpoint={historyFor}
        onClose={() => setHistoryFor(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}

/* ── Delivery log ─────────────────────────────────────────────── */

function DeliveryDrawer({
  endpoint,
  onClose,
  onChanged,
}: {
  endpoint: WebhookEndpoint | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<DeliveryStatus | undefined>();

  const load = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    try {
      setRows(await webhooksApi.deliveries(endpoint.endpoint_id, { status, limit: 100 }));
    } catch (err) {
      message.error(err instanceof Error ? err.message : t("webhook.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [endpoint, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (deliveryId: string) => {
    try {
      await webhooksApi.retry(deliveryId);
      message.success(t("webhook.retried"));
      await load();
      onChanged();
    } catch (err) {
      message.error(err instanceof Error ? err.message : t("webhook.saveFailed"));
    }
  };

  return (
    <Drawer
      open={endpoint !== null}
      onClose={onClose}
      width={860}
      title={t("webhook.deliveriesTitle", { name: endpoint?.name ?? "" })}
      extra={
        <Space>
          <Select
            allowClear
            style={{ width: 140 }}
            placeholder={t("webhook.statusFilter")}
            value={status}
            onChange={(value) => setStatus(value)}
            options={(["pending", "sending", "delivered", "failed"] as DeliveryStatus[]).map(
              (value) => ({ value, label: value }),
            )}
          />
          <Button icon={<RefreshCw size={14} />} onClick={() => void load()}>
            {t("common.refresh")}
          </Button>
        </Space>
      }
    >
      <Table<WebhookDelivery>
        className={styles.deliveryTable}
        size="small"
        rowKey="delivery_id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: "max-content" }}
        columns={[
          {
            title: t("webhook.colStatus"),
            dataIndex: "status",
            width: 110,
            render: (value: DeliveryStatus) => (
              <Tag color={STATUS_COLOR[value]} className={styles.statusCell}>
                {value}
              </Tag>
            ),
          },
          { title: t("webhook.colType"), dataIndex: "type", width: 220 },
          { title: t("webhook.colAgent"), dataIndex: "agent_id", width: 140 },
          {
            title: t("webhook.colThread"),
            dataIndex: "thread_id",
            width: 200,
            ellipsis: true,
          },
          { title: t("webhook.colAttempts"), dataIndex: "attempts", width: 80 },
          {
            title: t("webhook.colResponse"),
            dataIndex: "response_code",
            width: 90,
            render: (value: number | null) => value ?? "—",
          },
          {
            title: t("webhook.colError"),
            dataIndex: "last_error",
            ellipsis: true,
            render: (value: string | null) => value ?? "—",
          },
          {
            title: "",
            width: 90,
            render: (_, row) =>
              row.status === "failed" ? (
                <Button size="small" onClick={() => void retry(row.delivery_id)}>
                  {t("webhook.retry")}
                </Button>
              ) : null,
          },
        ]}
      />
    </Drawer>
  );
}

export default WebhooksSettingsPanel;
export { ALL_EVENT_TYPES };

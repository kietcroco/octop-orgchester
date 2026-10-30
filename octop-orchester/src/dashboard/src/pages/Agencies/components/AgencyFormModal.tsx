import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Form, Input, Modal } from "antd";

import ExpertColorPicker from "../../../components/ExpertColorPicker";
import {
  createAgency,
  updateAgency,
  type AgencySummary,
  type AgencyWriteBody,
} from "../../../api/modules/agency";
import { parseApiError } from "../../../utils/apiError";

export interface AgencyFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  /** Initial values when editing; ignored on create. */
  initial?: AgencySummary | null;
  onClose: () => void;
  onSaved: (agency: AgencySummary) => void;
}

interface FormValues {
  name: string;
  description?: string;
  color?: string;
}

export function AgencyFormModal({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: AgencyFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      color: initial?.color ?? undefined,
    });
  }, [open, initial, form]);

  const submit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const body: AgencyWriteBody = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
    };
    if (values.color) body.color = values.color;

    setSaving(true);
    try {
      const saved =
        mode === "edit" && initial
          ? await updateAgency(initial.agency_id, body)
          : await createAgency(body);
      onSaved(saved);
    } catch (error) {
      // The request wrapper folds the HTTP status into the message text and
      // keeps the server's error envelope after " - ". 409 = duplicate name.
      // ponytail: string match, same trick as utils/apiError.isNotFoundApiError;
      // swap for a status field on the thrown error if one ever lands there.
      const duplicate =
        /\b409\b/.test(error instanceof Error ? error.message : "") ||
        parseApiError(error)?.code === "AGENCY_NAME_TAKEN";
      const text = duplicate
        ? t("agencies.nameTaken")
        : t("agencies.saveFailed");
      form.setFields([{ name: "name", errors: [text] }]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={mode === "edit" ? t("agencies.editTitle") : t("agencies.createTitle")}
      okText={t("agencies.save")}
      cancelText={t("agencies.cancel")}
      confirmLoading={saving}
      okButtonProps={{ disabled: saving }}
      maskClosable={!saving}
      onOk={() => void submit()}
      onCancel={() => {
        if (!saving) onClose();
      }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" disabled={saving}>
        <Form.Item
          name="name"
          label={t("agencies.name")}
          rules={[{ required: true, whitespace: true, max: 64 }]}
        >
          <Input
            maxLength={64}
            placeholder={t("agencies.namePlaceholder")}
            autoFocus
          />
        </Form.Item>
        <Form.Item name="description" label={t("agencies.description")}>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 5 }}
            maxLength={500}
            placeholder={t("agencies.descriptionPlaceholder")}
          />
        </Form.Item>
        <Form.Item name="color" label={t("agencies.color")}>
          <ExpertColorPicker />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default AgencyFormModal;

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Form, Input, Modal, Radio } from "antd";

import { message } from "@/utils/antdMessage";
import { flowApi, type FlowDTO } from "../../../api/modules/flows";
import { FLOW_TEMPLATES, type FlowTemplateId } from "../lib/templates";

export interface CreateFlowModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (flow: FlowDTO) => void;
}

interface FormValues {
  template: FlowTemplateId;
  name: string;
  description?: string;
}

export function CreateFlowModal({
  open,
  onClose,
  onCreated,
}: CreateFlowModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  const templateOf = (id: FlowTemplateId) => {
    const template = FLOW_TEMPLATES.find((item) => item.id === id);
    return (template ?? FLOW_TEMPLATES[0]).build(t);
  };

  const submit = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const { nodes, edges } = templateOf(values.template);

    setSaving(true);
    try {
      const flow = await flowApi.create({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        nodes,
        edges,
      });
      onCreated(flow);
    } catch {
      message.error(t("flows.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("flows.createTitle")}
      okText={t("flows.save")}
      cancelText={t("flows.cancel")}
      confirmLoading={saving}
      okButtonProps={{ disabled: saving }}
      maskClosable={!saving}
      onOk={() => void submit()}
      onCancel={() => {
        if (!saving) onClose();
      }}
      destroyOnHidden
    >
      {/* destroyOnHidden remounts the form on every open; preserve={false}
          drops the old values so initialValues reset it to a blank flow. */}
      <Form
        form={form}
        layout="vertical"
        disabled={saving}
        preserve={false}
        initialValues={{
          template: "blank",
          name: templateOf("blank").name,
          description: "",
        }}
        onValuesChange={(changed: Partial<FormValues>) => {
          if (changed.template) {
            form.setFieldValue("name", templateOf(changed.template).name);
          }
        }}
      >
        <Form.Item name="template" label={t("flows.template")}>
          <Radio.Group style={{ display: "grid", gap: 8 }}>
            {FLOW_TEMPLATES.map((template) => {
              const built = template.build(t);
              return (
                <Radio key={template.id} value={template.id}>
                  <span style={{ fontWeight: 500 }}>{built.name}</span>
                  <br />
                  <span
                    style={{ fontSize: 12, color: "var(--fn-text-tertiary)" }}
                  >
                    {built.description}
                  </span>
                </Radio>
              );
            })}
          </Radio.Group>
        </Form.Item>
        <Form.Item
          name="name"
          label={t("flows.name")}
          rules={[{ required: true, whitespace: true, max: 64 }]}
        >
          <Input maxLength={64} placeholder={t("flows.namePlaceholder")} />
        </Form.Item>
        <Form.Item name="description" label={t("flows.description")}>
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 5 }}
            maxLength={500}
            placeholder={t("flows.descriptionPlaceholder")}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default CreateFlowModal;

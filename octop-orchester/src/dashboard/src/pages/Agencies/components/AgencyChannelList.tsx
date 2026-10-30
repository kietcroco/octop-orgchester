import { useTranslation } from "react-i18next";
import { Tag } from "antd";

import type { AgencyChannel } from "../../../api/modules/agency";
import styles from "../index.module.less";

export interface AgencyChannelListProps {
  channels: AgencyChannel[];
}

/** Read-only: channel membership is managed from the agent's channel catalog. */
export function AgencyChannelList({ channels }: AgencyChannelListProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>{t("agencies.channels")}</div>

      {channels.length === 0 ? (
        <div className={styles.panelEmpty}>{t("agencies.noChannels")}</div>
      ) : (
        <div className={styles.memberList}>
          {channels.map((channel) => (
            <div key={channel.channel_id} className={styles.channelRow}>
              <div className={styles.channelBody}>
                <div className={styles.channelName}>{channel.name}</div>
                <div className={styles.channelAgent}>{channel.agent_id}</div>
              </div>
              <Tag color={channel.enabled ? "green" : undefined}>
                {channel.enabled
                  ? t("common.enabled")
                  : t("common.disabled")}
              </Tag>
              <Tag>{channel.kind}</Tag>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AgencyChannelList;

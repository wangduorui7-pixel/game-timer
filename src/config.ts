/** 全局配置 */
export const APP_CONFIG = {
  name: '五游活动倒计时台',
  description: '原神 / 星铁 / 绝区零 / 鸣潮 / 终末地 活动截止倒计时',
  version: '1.0.0',
  /** 活动数据自动轮询间隔（ms） */
  pollIntervalMs: 5 * 60 * 1000,
  /** 倒计时告警阈值（ms）：小于该值视为「紧急」 */
  urgentThresholdMs: 24 * 60 * 60 * 1000,
};

export default APP_CONFIG;

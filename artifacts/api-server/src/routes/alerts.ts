import { Router, type IRouter } from "express";
import {
  getAlertConfig,
  saveAlertConfig,
  testAlert,
  type AlertConfig,
} from "../lib/alert-sender";

const router: IRouter = Router();

router.get("/alerts/config", async (req, res) => {
  const config = await getAlertConfig();
  res.json(config);
});

router.put("/alerts/config", async (req, res) => {
  const { webhookUrl, onOffline, onRecovery, latencyThresholdMs, cooldownMinutes } = req.body as Partial<AlertConfig>;
  const current = await getAlertConfig();
  const updated: AlertConfig = {
    webhookUrl: webhookUrl !== undefined ? (webhookUrl || null) : current.webhookUrl,
    onOffline: onOffline !== undefined ? Boolean(onOffline) : current.onOffline,
    onRecovery: onRecovery !== undefined ? Boolean(onRecovery) : current.onRecovery,
    latencyThresholdMs:
      latencyThresholdMs !== undefined
        ? latencyThresholdMs === null || latencyThresholdMs === 0
          ? null
          : Number(latencyThresholdMs)
        : current.latencyThresholdMs,
    cooldownMinutes: cooldownMinutes !== undefined ? Number(cooldownMinutes) : current.cooldownMinutes,
  };
  try {
    await saveAlertConfig(updated);
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "alerts: 保存配置失败");
    res.status(500).json({ error: "保存配置失败" });
  }
});

router.post("/alerts/test", async (req, res) => {
  const { webhookUrl } = req.body as { webhookUrl?: string };
  if (!webhookUrl) {
    res.status(400).json({ error: "webhookUrl 不能为空" });
    return;
  }
  const result = await testAlert(webhookUrl);
  res.json(result);
});

export default router;

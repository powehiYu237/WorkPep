/** 主题管理：localStorage 持久化 + BroadcastChannel 跨窗口同步 */

export const THEMES = ["original", "dark-gold", "mint", "sunset", "navy", "sakura"] as const;

export const THEME_NAMES: Record<string, string> = {
  original: "暖白",
  "dark-gold": "暗金",
  mint: "薄荷",
  sunset: "落日",
  navy: "藏蓝",
  sakura: "樱粉",
};

export const THEME_SWATCH: Record<string, string> = {
  original: "#C23B22",
  "dark-gold": "#F0C75E",
  mint: "#1D5C3F",
  sunset: "#D93A20",
  navy: "#1B2A5E",
  sakura: "#D4637E",
};

export function getThemeIdx(): number {
  const idx = +(localStorage.getItem("wg-theme") ?? 0);
  return idx >= 0 && idx < THEMES.length ? idx : 0;
}

export function applyTheme(idx: number) {
  document.documentElement.dataset.theme = THEMES[idx];
}

export function setTheme(idx: number) {
  applyTheme(idx);
  localStorage.setItem("wg-theme", String(idx));
  broadcast({ type: "theme", idx });
}

/** 跨窗口消息通道（主题 / 设置变更） */
export interface SyncMessage {
  type: "theme" | "settings";
  idx?: number;
}

export function broadcast(msg: SyncMessage) {
  try {
    new BroadcastChannel("wg-sync").postMessage(msg);
  } catch {
    /* 忽略 */
  }
}

/** 设置保存后广播，让其他窗口热重载配置 */
export function broadcastSettingsChanged() {
  broadcast({ type: "settings" });
}

/** 监听其他窗口的消息 */
export function watchSync(handler: (msg: SyncMessage) => void): void {
  try {
    const ch = new BroadcastChannel("wg-sync");
    ch.onmessage = (e) => handler(e.data as SyncMessage);
  } catch {
    /* 忽略 */
  }
}

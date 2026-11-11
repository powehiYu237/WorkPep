import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * 无边框窗口拖动：按下时启动系统级窗口拖动。
 * 按钮 / 输入框等交互元素不触发（否则无法点击和输入）。
 */
export function dragHandler(e: MouseEvent) {
  if (e.button !== 0) return;
  const t = e.target as HTMLElement | null;
  if (t && t.closest("button, input, select, textarea, a, .no-drag")) return;
  getCurrentWindow()
    .startDragging()
    .catch(() => {
      /* 浏览器开发模式无 Tauri API */
    });
}

<script setup lang="ts">
import { getCurrentWindow } from "@tauri-apps/api/window";
import CalendarPanel from "./components/CalendarPanel.vue";
import { applyTheme, getThemeIdx, watchSync } from "./theme";
import { dragHandler } from "./utils/drag";

applyTheme(getThemeIdx());
watchSync((msg) => {
  if (msg.type === "theme" && typeof msg.idx === "number") {
    applyTheme(msg.idx);
  }
});

async function close() {
  try {
    await getCurrentWindow().close();
  } catch {
    /* 浏览器开发模式 */
  }
}

async function minimize() {
  try {
    await getCurrentWindow().minimize();
  } catch {
    /* 浏览器开发模式 */
  }
}
</script>

<template>
  <div class="settings-window calendar-window" @mousedown="dragHandler">
    <div class="settings-bar">
      <span class="settings-title">上班日历</span>
      <div class="spacer"></div>
      <button class="settings-btn" title="最小化" @click="minimize">—</button>
      <button class="settings-btn" title="关闭" @click="close">✕</button>
    </div>
    <CalendarPanel />
  </div>
</template>

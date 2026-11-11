<script setup lang="ts">
import { getCurrentWindow } from "@tauri-apps/api/window";
import SettingsPanel from "./components/SettingsPanel.vue";
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
  <div class="settings-window" @mousedown="dragHandler">
    <div class="settings-bar">
      <span class="settings-title">设置 · 上班鼓励器</span>
      <div class="spacer"></div>
      <button class="settings-btn" title="最小化" @click="minimize">—</button>
      <button class="settings-btn" title="关闭" @click="close">✕</button>
    </div>
    <SettingsPanel @close="close" />
  </div>
</template>

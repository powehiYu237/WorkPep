<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { QUOTES } from "../utils/quotes";

const shown = ref("");
const full = ref("");
let quoteIdx = Math.floor(Math.random() * QUOTES.length);
let charIdx = 0;
let typeTimer: ReturnType<typeof setInterval> | null = null;
let nextTimer: ReturnType<typeof setTimeout> | null = null;

function pick() {
  full.value = QUOTES[quoteIdx % QUOTES.length];
  quoteIdx++;
  charIdx = 0;
  shown.value = "";
  typeTimer = setInterval(() => {
    if (charIdx >= full.value.length) {
      if (typeTimer) clearInterval(typeTimer);
      nextTimer = setTimeout(pick, 5000);
      return;
    }
    charIdx++;
    shown.value = full.value.slice(0, charIdx);
  }, 120);
}

onMounted(pick);
onUnmounted(() => {
  if (typeTimer) clearInterval(typeTimer);
  if (nextTimer) clearTimeout(nextTimer);
});
</script>

<template>
  <div class="quote-box">
    <span class="quote">{{ shown }}<span class="caret"></span></span>
  </div>
</template>

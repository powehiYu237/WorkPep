import { defineStore } from "pinia";
import { onUnmounted, ref } from "vue";

/** 全局共享的秒级时钟，所有卡片使用同一个节拍器（对齐整秒，1Hz） */
export const useClockStore = defineStore("clock", () => {
  const now = ref(new Date());
  let timer: ReturnType<typeof setTimeout> | null = null;
  let users = 0;

  function tick() {
    now.value = new Date();
    // 对齐到下一个整秒 +25ms 余量，避免用 250ms 高频轮询空烧 CPU
    timer = setTimeout(tick, 1000 - (Date.now() % 1000) + 25);
  }

  function acquire() {
    users++;
    if (timer === null) tick();
  }

  function release() {
    users = Math.max(0, users - 1);
    if (users === 0 && timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return { now, acquire, release };
});

/** 组合式：在组件里拿一个自动跟随的 now */
export function useNow() {
  const clock = useClockStore();
  clock.acquire();
  onUnmounted(() => clock.release());
  return clock;
}

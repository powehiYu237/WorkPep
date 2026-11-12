import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { OvertimeSession } from "../types";
import { dateKeyOf, hmToMin } from "../utils/overtime";
import { broadcastOvertimeChanged } from "../theme";

const STORAGE_KEY = "work-encourager-overtime-v1";

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 读取并清洗持久化数据，丢弃结构不合法的记录 */
function load(): OvertimeSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is OvertimeSession =>
          !!s &&
          typeof s.id === "string" &&
          typeof s.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
          typeof s.startAt === "number" &&
          Number.isFinite(s.startAt) &&
          (s.endAt === null || (typeof s.endAt === "number" && s.endAt > s.startAt)) &&
          (s.source === "live" || s.source === "manual"),
      )
      .map((s) => ({ ...s }));
  } catch {
    return [];
  }
}

export const useOvertimeStore = defineStore("overtime", () => {
  const sessions = ref<OvertimeSession[]>(load());

  /** 正在进行中的加班（同一时间只会有一条） */
  const active = computed(() => sessions.value.find((s) => s.endAt === null) ?? null);

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.value));
  }

  function commit(next: OvertimeSession[]) {
    sessions.value = next;
    persist();
    broadcastOvertimeChanged();
  }

  /** 打开加班开关：从现在开始实时累计（跨午夜自动持续） */
  function startLive(at: Date = new Date()) {
    if (active.value) return;
    commit([
      ...sessions.value,
      {
        id: uid(),
        date: dateKeyOf(at),
        startAt: at.getTime(),
        endAt: null,
        source: "live",
      },
    ]);
  }

  /** 关闭加班开关：结束当前进行中的加班 */
  function stopLive(at: Date = new Date()) {
    const cur = active.value;
    if (!cur) return;
    const endAt = Math.max(at.getTime(), cur.startAt + 1000); // 至少记 1 秒
    commit(sessions.value.map((s) => (s.id === cur.id ? { ...s, endAt } : s)));
  }

  /**
   * 补录某天的一段加班。
   * @param date  "YYYY-MM-DD"
   * @param start "HH:mm"
   * @param end   "HH:mm"（小于开始时间视为跨午夜）
   * @returns 错误文案；成功返回 null
   */
  function addManual(date: string, start: string, end: string, note?: string): string | null {
    const sm = hmToMin(start);
    const em = hmToMin(end);
    if (sm === em) return "开始与结束时间不能相同";
    if (date > dateKeyOf(new Date())) return "未来日期不能补录";

    const [y, m, d] = date.split("-").map(Number);
    const startAt = new Date(y, m - 1, d, Math.floor(sm / 60), sm % 60).getTime();
    let endAt = new Date(y, m - 1, d, Math.floor(em / 60), em % 60).getTime();
    if (endAt <= startAt) endAt += 24 * 3600 * 1000; // 跨午夜

    const nowTs = Date.now();
    if (endAt > nowTs) return "不能补录尚未发生的时间";
    const clash = sessions.value.some((s) => {
      const sEnd = s.endAt ?? nowTs;
      return startAt < sEnd && endAt > s.startAt;
    });
    if (clash) return "与已有加班记录时间重叠";

    commit([
      ...sessions.value,
      { id: uid(), date, startAt, endAt, source: "manual", note: note || undefined },
    ]);
    return null;
  }

  function remove(id: string) {
    commit(sessions.value.filter((s) => s.id !== id));
  }

  /** 从 localStorage 重新加载（跨窗口同步 / 窗口重新聚焦时调用） */
  function reload() {
    sessions.value = load();
  }

  return { sessions, active, startLive, stopLive, addManual, remove, reload };
});

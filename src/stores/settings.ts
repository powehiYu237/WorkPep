import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Settings } from "../types";
import { paidHoursPerDay } from "../utils/salary";

const STORAGE_KEY = "work-encourager-settings-v1";

const DEFAULT_SETTINGS: Settings = {
  salaryMode: "month",
  monthlySalary: 10000,
  annualSalary: 156000,
  hourSalary: 50,
  restPattern: "double",
  workStart: "09:00",
  workEnd: "18:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  lunchPaid: false,
  payday: 10,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<Settings>(load());

  function save(next: Settings) {
    settings.value = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function reset() {
    settings.value = { ...DEFAULT_SETTINGS };
    localStorage.removeItem(STORAGE_KEY);
  }

  /** 从 localStorage 重新加载（供设置窗口保存后主窗口热更新） */
  function reload() {
    settings.value = load();
  }

  /** 折算后的"月薪"（年薪模式按 12 个月） */
  const monthlyEquivalent = computed(() => {
    const s = settings.value;
    if (s.salaryMode === "year") return s.annualSalary / 12;
    if (s.salaryMode === "hour") return s.hourSalary * paidHoursPerDay(s) * 21.75;
    return s.monthlySalary;
  });

  return { settings, save, reset, reload, monthlyEquivalent, defaults: DEFAULT_SETTINGS };
});

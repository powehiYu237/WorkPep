<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { SalaryMode, Settings } from "../types";
import { useSettingsStore } from "../stores/settings";
import { dailyPay, paidHoursPerDay } from "../utils/salary";
import { THEMES, THEME_NAMES, THEME_SWATCH, getThemeIdx, setTheme, broadcastSettingsChanged } from "../theme";

const emit = defineEmits<{ close: [] }>();

const store = useSettingsStore();

// 编辑草稿：确定后才写回
const draft = reactive<Settings>(JSON.parse(JSON.stringify(store.settings)));

/* 保存成功提示 */
const toast = ref(false);
const toastMsg = ref("✅ 已保存，主窗口已实时更新");
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string) {
  toastMsg.value = msg;
  toast.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = false), 2000);
}

/* 主题：记录打开时的主题，取消时回滚（主题选择是即时预览，但取消不生效） */
const initialTheme = getThemeIdx();
const themeIdx = ref(initialTheme);
function pickTheme(i: number) {
  themeIdx.value = i;
  setTheme(i);
}

/** 保存前校验/清洗：非法输入回退为默认值 */
function sanitize(s: Settings): Settings {
  const nonNeg = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  const hm = (v: string, fb: string) => (/^\d{1,2}:\d{2}$/.test(v) ? v : fb);
  return {
    ...s,
    monthlySalary: nonNeg(s.monthlySalary),
    annualSalary: nonNeg(s.annualSalary),
    hourSalary: nonNeg(s.hourSalary),
    payday: Math.min(31, Math.max(1, Math.round(s.payday) || 1)),
    overtimeMultiplier: Number.isFinite(s.overtimeMultiplier)
      ? Math.min(10, Math.max(0.5, s.overtimeMultiplier))
      : 1.5,
    workStart: hm(s.workStart, "09:00"),
    workEnd: hm(s.workEnd, "18:00"),
    lunchStart: hm(s.lunchStart, "12:00"),
    lunchEnd: hm(s.lunchEnd, "13:00"),
  };
}

function save() {
  store.save(sanitize(JSON.parse(JSON.stringify(draft))));
  broadcastSettingsChanged();
  showToast("✅ 已保存，主窗口已实时更新");
}

/** 恢复默认：只重置草稿，点"保存"才落盘（避免"恢复默认+取消"悄悄清掉用户配置） */
function resetAll() {
  Object.assign(draft, JSON.parse(JSON.stringify(store.defaults)));
  showToast("↩️ 已恢复默认，点保存后生效");
}

/** 取消：回滚主题预览后关闭 */
function cancel() {
  if (themeIdx.value !== initialTheme) setTheme(initialTheme);
  emit("close");
}

const modes: { value: SalaryMode; label: string }[] = [
  { value: "month", label: "月薪" },
  { value: "year", label: "年薪" },
  { value: "hour", label: "时薪" },
];

const patterns = [
  { value: "double", label: "双休" },
  { value: "single", label: "单休" },
  { value: "alternate", label: "大小周" },
] as const;

/** 加班时薪预览（常规时薪 × 倍率） */
const overtimeRatePreview = computed(() => {
  const hours = paidHoursPerDay(draft);
  if (hours <= 0) return "0.00";
  return ((dailyPay(new Date(), draft) / hours) * draft.overtimeMultiplier).toFixed(2);
});
</script>

<template>
  <div class="modal">
    <div class="form-grid">
      <div class="form-item">
        <label>颜色主题</label>
        <div class="theme-row">
          <button
            v-for="(t, i) in THEMES"
            :key="t"
            class="theme-swatch"
            :class="{ active: themeIdx === i }"
            @click="pickTheme(i)"
          >
            <span class="dot" :style="{ background: THEME_SWATCH[t] }"></span>
            {{ THEME_NAMES[t] }}
          </button>
        </div>
      </div>

      <div class="form-item">
        <label>薪资模式</label>
        <div class="seg">
          <button
            v-for="m in modes"
            :key="m.value"
            :class="{ active: draft.salaryMode === m.value }"
            @click="draft.salaryMode = m.value"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <div class="form-item" v-if="draft.salaryMode === 'month'">
        <label>月薪（元）</label>
        <input v-model.number="draft.monthlySalary" type="number" min="0" step="100" />
      </div>
      <div class="form-item" v-else-if="draft.salaryMode === 'year'">
        <label>年薪（元，按 12 个月折算）</label>
        <input v-model.number="draft.annualSalary" type="number" min="0" step="1000" />
      </div>
      <div class="form-item" v-else>
        <label>时薪（元/小时）</label>
        <input v-model.number="draft.hourSalary" type="number" min="0" step="1" />
      </div>

      <div class="form-item">
        <label>休息模式</label>
        <div class="seg">
          <button
            v-for="p in patterns"
            :key="p.value"
            :class="{ active: draft.restPattern === p.value }"
            @click="draft.restPattern = p.value"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <div class="time-pair">
        <div class="form-item">
          <label>加班工资倍率（×）</label>
          <input
            v-model.number="draft.overtimeMultiplier"
            type="number"
            min="0.5"
            max="10"
            step="0.5"
            placeholder="1.5"
          />
        </div>
        <div class="form-item">
          <label>加班时薪预览</label>
          <input :value="'¥' + overtimeRatePreview + ' / 小时'" disabled />
        </div>
      </div>
      <div class="form-hint">加班时长按「1.5 倍工资」等倍率折算，作用于加班开关与补录的全部记录</div>

      <div class="time-pair">
        <div class="form-item">
          <label>上班时间</label>
          <input v-model="draft.workStart" type="time" />
        </div>
        <div class="form-item">
          <label>下班（可跨午夜）</label>
          <input v-model="draft.workEnd" type="time" />
        </div>
      </div>

      <div class="time-pair">
        <div class="form-item">
          <label>午休开始</label>
          <input v-model="draft.lunchStart" type="time" />
        </div>
        <div class="form-item">
          <label>午休结束</label>
          <input v-model="draft.lunchEnd" type="time" />
        </div>
      </div>

      <div class="form-item">
        <label class="checkbox">
          <input v-model="draft.lunchPaid" type="checkbox" style="width: 15px; height: 15px" />
          午休期间也计薪（不打勾则午休暂停计薪）
        </label>
      </div>

      <div class="time-pair">
        <div class="form-item">
          <label>发薪日（每月几号）</label>
          <input v-model.number="draft.payday" type="number" min="1" max="31" />
        </div>
        <div class="form-item">
          <label>当前每日带薪工时</label>
          <input :value="paidHoursPerDay(draft).toFixed(2) + ' 小时'" disabled />
        </div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" @click="resetAll">恢复默认</button>
      <button class="btn" @click="cancel">取消</button>
      <button class="btn primary" @click="save">保存</button>
    </div>

    <transition name="toast">
      <div v-if="toast" class="save-toast">{{ toastMsg }}</div>
    </transition>
  </div>
</template>

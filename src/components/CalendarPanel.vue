<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useSettingsStore } from "../stores/settings";
import { useOvertimeStore } from "../stores/overtime";
import { useNow } from "../stores/clock";
import {
  computeDayState,
  dailyPay,
  dayKind,
  fmtMoney,
  monthWorkdays,
  overtimePayOn,
  paidHoursPerDay,
  sessionPay,
} from "../utils/salary";
import {
  dateKeyOf,
  fmtDurationCn,
  fmtSessionRange,
  hmToMin,
  minToHM,
  overtimeSecondsOn,
  parseDateKey,
  sessionSeconds,
  sessionsOn,
} from "../utils/overtime";
import type { DayKind } from "../types";
import { watchSync } from "../theme";

const clock = useNow();
const store = useSettingsStore();
const { settings } = storeToRefs(store);
const ot = useOvertimeStore();
const { sessions } = storeToRefs(ot);

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const WEEK_FULL = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const nowKey = computed(() => dateKeyOf(clock.now));

/* ===== 视图状态 ===== */
const viewYear = ref(clock.now.getFullYear());
const viewMonth = ref(clock.now.getMonth()); // 0-11
const selectedKey = ref(nowKey.value);

const selectedIsFuture = computed(() => selectedKey.value > nowKey.value);

const todayState = computed(() => computeDayState(clock.now, settings.value, sessions.value));
const paidHours = computed(() => paidHoursPerDay(settings.value));

/* ===== 日历网格 ===== */
interface Cell {
  key: string;
  date: Date;
  inMonth: boolean;
  kind: DayKind;
  today: boolean;
  baseSec: number;
  basePay: number;
  otSec: number;
  otPay: number;
}

const cells = computed<Cell[]>(() => {
  const y = viewYear.value;
  const m = viewMonth.value;
  const first = new Date(y, m, 1);
  const lead = (first.getDay() + 6) % 7; // 周一为一周起点
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;

  // 同一个月的工作日数只算一次（跨月的前后补位日期各自缓存）
  const mwCache = new Map<string, number>();
  const workdaysOf = (d: Date): number => {
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    let v = mwCache.get(k);
    if (v === undefined) {
      v = monthWorkdays(d.getFullYear(), d.getMonth(), settings.value);
      mwCache.set(k, v);
    }
    return v;
  };

  const out: Cell[] = [];
  for (let i = 0; i < total; i++) {
    const date = new Date(y, m, 1 - lead + i);
    const key = dateKeyOf(date);
    const kind = dayKind(date, settings.value);
    const isToday = key === nowKey.value;

    // 工作工时：过去的工作日按排班满勤，今天按实时进度，未来为 0
    let baseSec = 0;
    let basePay = 0;
    if (kind.workday) {
      if (key < nowKey.value) {
        baseSec = paidHours.value * 3600;
        basePay = dailyPay(date, settings.value, workdaysOf(date));
      } else if (isToday) {
        baseSec = todayState.value.progress * paidHours.value * 3600;
        basePay = todayState.value.baseEarned;
      }
    }

    out.push({
      key,
      date,
      inMonth: date.getMonth() === m,
      kind,
      today: isToday,
      baseSec,
      basePay,
      otSec: overtimeSecondsOn(key, sessions.value, clock.now),
      otPay: overtimePayOn(key, sessions.value, settings.value, clock.now),
    });
  }
  return out;
});

const summary = computed(() => {
  let workSec = 0;
  let otSec = 0;
  let otPay = 0;
  for (const c of cells.value) {
    if (!c.inMonth) continue;
    workSec += c.baseSec;
    otSec += c.otSec;
    otPay += c.otPay;
  }
  return { workSec, otSec, otPay };
});

/* ===== 选中日详情 ===== */
const selectedCell = computed(() => cells.value.find((c) => c.key === selectedKey.value));
const selectedDate = computed(() => parseDateKey(selectedKey.value));
const selectedKind = computed<DayKind>(
  () => selectedCell.value?.kind ?? dayKind(selectedDate.value, settings.value),
);
const selectedTitle = computed(() => {
  const d = selectedDate.value;
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${WEEK_FULL[d.getDay()]}`;
});
const selectedTag = computed(() => {
  const k = selectedKind.value;
  if (k.reason === "holiday") return k.name ?? "法定节假日";
  if (k.reason === "makeup") return k.name ?? "调休上班";
  return k.workday ? "工作日" : "休息日";
});

const selBaseSec = computed(() => selectedCell.value?.baseSec ?? 0);
const selBasePay = computed(() => selectedCell.value?.basePay ?? 0);
const selOtSec = computed(() => selectedCell.value?.otSec ?? 0);
const selOtPay = computed(() => selectedCell.value?.otPay ?? 0);
const selTotal = computed(() => selBasePay.value + selOtPay.value);
const selectedSessions = computed(() =>
  sessionsOn(selectedKey.value, sessions.value).sort((a, b) => a.startAt - b.startAt),
);

/* ===== 月份切换 / 选择 ===== */
function shiftMonth(delta: number) {
  const d = new Date(viewYear.value, viewMonth.value + delta, 1);
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
  selectedKey.value = dateKeyOf(d);
  resetAddForm();
}

function goToday() {
  const t = clock.now;
  viewYear.value = t.getFullYear();
  viewMonth.value = t.getMonth();
  selectedKey.value = nowKey.value;
  resetAddForm();
}

function select(key: string) {
  const d = parseDateKey(key);
  // 点击上/下月的补位日期时，顺手切换到对应月份
  if (d.getFullYear() !== viewYear.value || d.getMonth() !== viewMonth.value) {
    viewYear.value = d.getFullYear();
    viewMonth.value = d.getMonth();
  }
  selectedKey.value = key;
  resetAddForm();
}

/* ===== 补录表单 ===== */
const addStart = ref("18:00");
const addEnd = ref("19:00");
const addError = ref("");

function resetAddForm() {
  addError.value = "";
  const startMin = hmToMin(settings.value.workEnd);
  // 今天默认补到当前时刻，过去的日期默认 1 小时
  const endMin =
    selectedKey.value === nowKey.value
      ? clock.now.getHours() * 60 + clock.now.getMinutes()
      : startMin + 60;
  const s = startMin >= endMin ? Math.max(0, endMin - 60) : startMin;
  addStart.value = minToHM(s);
  addEnd.value = minToHM(endMin);
}

const addPreviewSec = computed(() => {
  if (addStart.value === addEnd.value) return 0;
  const sm = hmToMin(addStart.value);
  const em = hmToMin(addEnd.value);
  const mins = em > sm ? em - sm : em + 1440 - sm;
  return mins * 60;
});

function addSession() {
  addError.value = "";
  if (selectedIsFuture.value) {
    addError.value = "未来日期不能补录";
    return;
  }
  if (addStart.value === addEnd.value) {
    addError.value = "开始与结束时间不能相同";
    return;
  }
  const err = ot.addManual(selectedKey.value, addStart.value, addEnd.value);
  if (err) addError.value = err;
}

/* ===== 跨窗口同步 ===== */
// 主窗口开关加班 / 修改设置后自动刷新
onMounted(() => {
  watchSync((msg) => {
    if (msg.type === "overtime") ot.reload();
    else if (msg.type === "settings") store.reload();
  });
  window.addEventListener("focus", onFocus);
});
onUnmounted(() => window.removeEventListener("focus", onFocus));
function onFocus() {
  store.reload();
  ot.reload();
}

/* ===== 格式化 ===== */
function fmtHours(sec: number): string {
  return `${(Math.round((sec / 3600) * 10) / 10).toFixed(1)}h`;
}
</script>

<template>
  <!-- no-drag：内容区的点击不能被窗口拖动逻辑吞掉，仅标题栏可拖动窗口 -->
  <div class="cal-panel no-drag">
    <!-- 月份导航 -->
    <div class="cal-nav">
      <button class="cal-nav-btn" title="上个月" @click="shiftMonth(-1)">‹</button>
      <span class="cal-month num">{{ viewYear }} 年 {{ viewMonth + 1 }} 月</span>
      <button class="cal-nav-btn" title="下个月" @click="shiftMonth(1)">›</button>
      <span class="cal-spacer"></span>
      <button class="cal-today-btn" @click="goToday">回到今天</button>
    </div>

    <!-- 本月汇总 -->
    <div class="cal-summary">
      <span>本月工作 <b class="num">{{ fmtHours(summary.workSec) }}</b></span>
      <span>加班 <b class="num accent">{{ fmtHours(summary.otSec) }}</b></span>
      <span>加班费 <b class="num accent">¥{{ fmtMoney(summary.otPay, 2) }}</b></span>
    </div>

    <!-- 星期表头 -->
    <div class="cal-weekdays">
      <span v-for="w in WEEK_LABELS" :key="w">{{ w }}</span>
    </div>

    <!-- 日历格子：工作日时长 + 加班时长 -->
    <div class="cal-grid">
      <div
        v-for="c in cells"
        :key="c.key"
        class="cal-cell"
        :class="{
          out: !c.inMonth,
          rest: !c.kind.workday,
          today: c.today,
          selected: c.key === selectedKey,
        }"
        :title="c.kind.name ? `${c.kind.name}` : c.kind.workday ? '工作日' : '休息日'"
        @click="select(c.key)"
      >
        <span class="cal-day num">{{ c.date.getDate() }}</span>
        <span class="cal-times">
          <span class="cal-hours num" v-if="c.baseSec > 0">{{ fmtHours(c.baseSec) }}</span>
          <span class="cal-ot num" v-if="c.otSec >= 60">+{{ fmtHours(c.otSec) }}</span>
        </span>
      </div>
    </div>

    <!-- 选中日详情 -->
    <div class="cal-detail">
      <div class="cal-detail-head">
        <span class="cal-sel-date">{{ selectedTitle }}</span>
        <span class="cal-tag" :class="{ rest: !selectedKind.workday }">{{ selectedTag }}</span>
        <span class="cal-spacer"></span>
        <span class="cal-detail-hint">工时按排班计 · 加班按实际记录</span>
      </div>

      <div class="cal-stats">
        <div class="cal-stat">
          <div class="k">工作</div>
          <div class="v num">{{ fmtHours(selBaseSec) }}</div>
          <div class="s num">¥{{ fmtMoney(selBasePay, 2) }}</div>
        </div>
        <div class="cal-stat">
          <div class="k">加班</div>
          <div class="v num accent">{{ fmtHours(selOtSec) }}</div>
          <div class="s num accent">¥{{ fmtMoney(selOtPay, 2) }}</div>
        </div>
        <div class="cal-stat">
          <div class="k">当日合计</div>
          <div class="v num">¥{{ fmtMoney(selTotal, 2) }}</div>
          <div class="s">{{ selectedSessions.length }} 条加班记录</div>
        </div>
      </div>

      <!-- 加班记录列表 -->
      <div class="cal-sessions">
        <div v-if="selectedSessions.length === 0" class="cal-empty">这一天还没有加班记录</div>
        <div v-for="s in selectedSessions" :key="s.id" class="cal-session">
          <span class="s-range num">{{ fmtSessionRange(s) }}</span>
          <span class="s-dur num">{{ fmtDurationCn(sessionSeconds(s, clock.now)) }}</span>
          <span class="s-pay num">¥{{ fmtMoney(sessionPay(s, settings, clock.now), 2) }}</span>
          <span class="s-tag" v-if="s.endAt === null">进行中</span>
          <span class="s-src">{{ s.source === "manual" ? "补录" : "计时" }}</span>
          <button class="s-del" title="删除这条记录" @click.stop="ot.remove(s.id)">✕</button>
        </div>
      </div>

      <!-- 补录表单 -->
      <div class="cal-add" v-if="!selectedIsFuture">
        <span class="cal-add-label">补录加班</span>
        <input type="time" v-model="addStart" />
        <span class="cal-add-sep">至</span>
        <input type="time" v-model="addEnd" />
        <span class="cal-add-preview num">
          {{ addStart === addEnd ? "时间无效" : fmtDurationCn(addPreviewSec) }}
        </span>
        <button class="btn primary cal-add-btn" @click="addSession">补录</button>
      </div>
      <div class="cal-add-hint" v-else>未来日期暂不能补录</div>
      <div class="cal-error" v-if="addError">{{ addError }}</div>
    </div>
  </div>
</template>

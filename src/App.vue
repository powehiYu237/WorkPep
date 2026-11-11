<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from "vue";
import { storeToRefs } from "pinia";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useNow } from "./stores/clock";
import { useSettingsStore } from "./stores/settings";
import {
  computeDayState,
  fmtMoney,
  monthEarnedToDate,
  nextPayday,
  nextRestDay,
  paidHoursPerDay,
} from "./utils/salary";
import { upcomingHolidays, hasHolidayData } from "./utils/holidays";
import { applyTheme, getThemeIdx, watchSync } from "./theme";
import { dragHandler } from "./utils/drag";
import QuotesBar from "./components/QuotesBar.vue";

const clock = useNow();
const store = useSettingsStore();
const { settings } = storeToRefs(store);

const dayState = computed(() => computeDayState(clock.now, settings.value));

/* 主题（可在设置窗口中切换，此处实时跟随） */
const themeIdx = ref(getThemeIdx());
watchEffect(() => applyTheme(themeIdx.value));

/* 设置窗口保存后热重载配置，无需重启 */
onMounted(() => {
  watchSync((msg) => {
    if (msg.type === "theme" && typeof msg.idx === "number") {
      themeIdx.value = msg.idx;
      applyTheme(msg.idx);
    } else if (msg.type === "settings") {
      store.reload();
    }
  });
});

/* ===== 文案 ===== */
const stateText: Record<string, string> = {
  beforeWork: "未上班",
  working: "上班中",
  lunch: "午休中",
  afterWork: "已下班",
  restDay: "休息中",
};

const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const dateText = computed(() => {
  const d = clock.now;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
});
const clockText = computed(() => {
  const d = clock.now;
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, "0")).join(":");
});

function fmtCountdown(total: number | null): string {
  if (total === null) return "";
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}小时${m}分${String(sec).padStart(2, "0")}秒`;
  if (m > 0) return `${m}分${String(sec).padStart(2, "0")}秒`;
  return `${sec}秒`;
}

const countdownText = computed(() => {
  const st = dayState.value;
  switch (st.status) {
    case "working":
      return `距离下班还有 ${fmtCountdown(st.countdownSeconds)}（${settings.value.workEnd} 下班）`;
    case "lunch":
      return `距离午休结束还有 ${fmtCountdown(st.countdownSeconds)}（${settings.value.lunchEnd} 上工）`;
    case "beforeWork":
      return "还没开工";
    case "afterWork":
      return "辛苦了！";
    default:
      return "今天不上班";
  }
});

/* ===== 右侧 meta：每日工时 / 午休 ===== */
const metaLine1 = computed(() => `每日 ${paidHoursPerDay(settings.value).toFixed(1)} 小时`);
const metaLine2 = computed(() => {
  const s = settings.value;
  const ls = s.lunchStart.split(":").map(Number);
  const le = s.lunchEnd.split(":").map(Number);
  const mins = Math.max(0, le[0] * 60 + le[1] - (ls[0] * 60 + ls[1]));
  return s.lunchPaid
    ? `午休 ${Math.floor(mins / 60)}小时${mins % 60 ? (mins % 60) + "分" : ""}（计薪）`
    : `午休 ${Math.floor(mins / 60)} 小时`;
});

/* ===== 进度行：已工作 / 总带薪小时 ===== */
const workedHours = computed(() => dayState.value.progress * paidHoursPerDay(settings.value));

/* ===== 日期信息行 ===== */
const payday = computed(() => nextPayday(clock.now, settings.value.payday));
const restDay = computed(() => nextRestDay(clock.now, settings.value));
const nextHoliday = computed(() => upcomingHolidays(clock.now, 120)[0]);

const paydayText = computed(() =>
  payday.value.days === 0
    ? "今天"
    : `${payday.value.date.getMonth() + 1}/${payday.value.date.getDate()} · ${payday.value.days}天`,
);
const restDayText = computed(() => (restDay.value.days === 0 ? "今天" : `${restDay.value.days}天`));

/* 节假日数据是否覆盖当前年份（未覆盖则提示更新数据表） */
const holidayMissing = computed(() => !hasHolidayData(clock.now.getFullYear()));

/* ===== 设置独立窗口 ===== */
async function openSettings() {
  try {
    const existing = await WebviewWindow.getByLabel("settings");
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }
    const win = new WebviewWindow("settings", {
      title: "设置 · 上班鼓励器",
      url: "index.html#/settings",
      width: 440,
      height: 700,
      resizable: true,
      center: true,
      decorations: false,
      transparent: true,
      shadow: false,
    });
    // 创建失败时不要静默（如权限/URL 问题），打印到控制台便于排查
    win.once("tauri://error", (e) => console.error("设置窗口创建失败：", e));
  } catch (e) {
    console.error("打开设置窗口出错：", e);
  }
}

async function closeApp() {
  try {
    await getCurrentWindow().close();
  } catch {
    /* 浏览器开发模式 */
  }
}

/** 最小化到系统托盘 */
async function hideToTray() {
  try {
    await getCurrentWindow().hide();
  } catch {
    /* 浏览器开发模式 */
  }
}
</script>

<template>
  <div class="app" @mousedown="dragHandler">
    <div class="widget">
      <div class="widget-inner">
        <!-- 顶部栏 -->
        <div class="header">
          <div class="logo">¥</div>
          <h1>上班鼓励器</h1>
          <div class="spacer"></div>
          <button class="btn-setting" @click="openSettings">设置</button>
          <button class="btn-setting" title="最小化到托盘" @click="hideToTray">—</button>
          <button class="btn-setting btn-close" title="关闭" @click="closeApp">✕</button>
        </div>

        <!-- 日期行 -->
        <div class="date-row">
          <span>{{ dateText }}</span>
          <span>{{ WEEK[clock.now.getDay()] }}</span>
          <span class="time num">{{ clockText }}</span>
        </div>

        <!-- 状态区 -->
        <div class="status">
          <div class="state">{{ stateText[dayState.status] }}</div>
          <div class="meta">{{ metaLine1 }}<br />{{ metaLine2 }}</div>
        </div>
        <div class="countdown">{{ countdownText }}</div>

        <!-- 今日已赚 -->
        <div class="earned">
          <div class="label">今日已赚</div>
          <div class="money num">
            <span class="yen">¥</span><span class="num-big">{{ fmtMoney(dayState.todayEarned) }}</span>
          </div>
          <div class="speed" v-if="dayState.status === 'working' || dayState.status === 'lunch'">
            当前赚钱速度 ¥<span class="num">{{ dayState.perSecond.toFixed(4) }}</span> / 秒
          </div>
          <div class="speed" v-else-if="dayState.status === 'afterWork'">今日薪资已全部到账 ✅</div>
          <div class="speed" v-else-if="dayState.status === 'beforeWork'">还没开工，钱在路上了</div>
          <div class="speed" v-else>休息日不产生收益，但产生快乐</div>
        </div>

        <!-- 进度条 -->
        <div class="progress">
          <div class="row">
            <span>
              今日工时进度
              <span class="pct num">{{ (dayState.progress * 100).toFixed(1) }}%</span>
            </span>
            <span class="right">
              已工作 <span class="num">{{ workedHours.toFixed(2) }}</span> /
              <span class="num">{{ paidHoursPerDay(settings).toFixed(2) }}</span> 小时
            </span>
          </div>
          <div class="bar">
            <i :style="{ width: Math.min(100, dayState.progress * 100) + '%' }"></i>
          </div>
        </div>

        <!-- 两列数据 -->
        <div class="grid">
          <div class="cell">
            <div class="k">时薪</div>
            <div class="v num">¥{{ dayState.perHour.toFixed(2) }}</div>
          </div>
          <div class="cell">
            <div class="k">今日满勤可得</div>
            <div class="v num">¥{{ fmtMoney(dayState.todayFull, 2) }}</div>
          </div>
        </div>

        <!-- 本月累计 -->
        <div class="month">
          <div>
            <div class="k">本月累计</div>
            <div class="sub">已过工作日薪资 + 今日实时</div>
          </div>
          <div class="v num">¥{{ fmtMoney(monthEarnedToDate(clock.now, settings), 2) }}</div>
        </div>

        <!-- 发薪日 / 休息日 / 节假日 -->
        <div class="days-line">
          <span>💸 发薪 <b class="num">{{ paydayText }}</b></span>
          <span>🛋️ 休息 <b class="num">{{ restDayText }}</b></span>
          <span v-if="nextHoliday">🎋 {{ nextHoliday.name }} <b class="num">{{ nextHoliday.days }}天</b></span>
          <span v-if="holidayMissing" title="请更新 src/utils/holidays.ts 中的节假日数据表">⚠️ {{ clock.now.getFullYear() }}节假日数据未收录</span>
        </div>

        <!-- 鼓励话语 -->
        <QuotesBar />
      </div>
    </div>
  </div>
</template>

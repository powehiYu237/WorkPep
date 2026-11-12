import type { DayKind, DayState, OvertimeSession, Settings } from "../types";
import { lookupHoliday } from "./holidays";
import { dateKeyOf, parseDateKey, sessionSeconds, sessionsOn } from "./overtime";

/* ---------------- 基础时间工具 ---------------- */

/** "HH:mm" -> 当天分钟数 */
export function parseHM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** 在某天的 Date 基础上加分钟数 */
const addMinutes = (day: Date, minutes: number): Date => new Date(day.getTime() + minutes * 60000);

/* ---------------- 休息日判定 ---------------- */

/** 大小周的锚点：2026-01-05（周一）记为第 0 周（大周），此后单周大、双周小 */
const ALT_WEEK_ANCHOR = new Date(2026, 0, 5).getTime();
const WEEK_MS = 7 * 86400000;

function isWeekend(d: Date, settings: Settings): boolean {
  const dow = d.getDay(); // 0=周日 6=周六
  switch (settings.restPattern) {
    case "double":
      return dow === 0 || dow === 6;
    case "single":
      return dow === 0;
    case "alternate": {
      const weekIdx = Math.floor((startOfDay(d).getTime() - ALT_WEEK_ANCHOR) / WEEK_MS);
      if (dow === 6) return weekIdx % 2 === 0; // 大周的周六休息
      if (dow === 0) return true; // 周日永远休
      return false;
    }
  }
}

/** 判定某天是否需要上班 */
export function dayKind(d: Date, settings: Settings): DayKind {
  const { makeup, holiday } = lookupHoliday(d);
  if (makeup) return { workday: true, reason: "makeup", name: makeup };
  if (holiday) return { workday: false, reason: "holiday", name: holiday };
  if (isWeekend(d, settings)) return { workday: false, reason: "weekend" };
  return { workday: true, reason: "weekday" };
}

/* ---------------- 每日班次 ---------------- */

export interface Shift {
  /** 班次归属日期（以上班时间为准） */
  date: Date;
  start: Date;
  end: Date;
  /** 带薪总时长（秒） */
  paidSeconds: number;
  /** 无薪午休区间（若开启），跨午夜已归一化到时间轴 */
  lunch: { start: Date; end: Date } | null;
}

export function buildShift(date: Date, settings: Settings): Shift {
  const day = startOfDay(date);
  const startMin = parseHM(settings.workStart);
  const endMin = parseHM(settings.workEnd);
  let span = endMin - startMin;
  if (span <= 0) span += 24 * 60; // 跨午夜夜班

  const start = addMinutes(day, startMin);
  const end = addMinutes(day, startMin + span);

  let lunch: { start: Date; end: Date } | null = null;
  const ls = parseHM(settings.lunchStart);
  const le = parseHM(settings.lunchEnd);
  if (le > ls) {
    let lunchStart = addMinutes(day, ls);
    let lunchEnd = addMinutes(day, le);
    // 夜班且午休时间落在跨午夜段：顺延一天
    if (ls < startMin) {
      lunchStart = addMinutes(day, ls + 24 * 60);
      lunchEnd = addMinutes(day, le + 24 * 60);
    }
    // 午休需与班次有交集
    if (lunchEnd > start && lunchStart < end) {
      lunch = { start: lunchStart, end: lunchEnd };
    }
  }

  const unpaidLunchSec =
    !settings.lunchPaid && lunch ? Math.max(0, (lunch.end.getTime() - lunch.start.getTime()) / 1000) : 0;

  return { date, start, end, paidSeconds: span * 60 - unpaidLunchSec, lunch };
}

/** 每日带薪工时（小时） */
export function paidHoursPerDay(settings: Settings): number {
  return buildShift(new Date(), settings).paidSeconds / 3600;
}

/** 截至时刻 t，该班次已累计的带薪秒数 */
function paidElapsedSeconds(shift: Shift, t: Date, settings: Settings): number {
  const clamped = new Date(Math.min(t.getTime(), shift.end.getTime()));
  let elapsed = (clamped.getTime() - shift.start.getTime()) / 1000;
  if (elapsed < 0) elapsed = 0;
  if (!settings.lunchPaid && shift.lunch) {
    const lStart = Math.max(shift.lunch.start.getTime(), shift.start.getTime());
    const lEnd = Math.min(shift.lunch.end.getTime(), clamped.getTime());
    if (lEnd > lStart) elapsed -= (lEnd - lStart) / 1000;
  }
  return Math.max(0, elapsed);
}

/* ---------------- 日薪 / 月薪换算 ---------------- */

/** 某月实际工作日数（含调休补班、剔除法定假日与周末） */
export function monthWorkdays(year: number, month: number, settings: Settings): number {
  const days = new Date(year, month + 1, 0).getDate();
  let n = 0;
  for (let d = 1; d <= days; d++) {
    if (dayKind(new Date(year, month, d), settings).workday) n++;
  }
  return Math.max(n, 1);
}

/** 月薪折算（年薪按 12 个月） */
export function effectiveMonthly(settings: Settings): number {
  switch (settings.salaryMode) {
    case "month":
      return settings.monthlySalary;
    case "year":
      return settings.annualSalary / 12;
    case "hour":
      return 0; // 时薪模式走 dailyPay
  }
}

/** 某天的应得日薪（可传入预计算的当月工作日数以避免重复遍历） */
export function dailyPay(
  date: Date,
  settings: Settings,
  workdays = monthWorkdays(date.getFullYear(), date.getMonth(), settings),
): number {
  if (settings.salaryMode === "hour") {
    return settings.hourSalary * (paidHoursPerDay(settings) || 0);
  }
  return effectiveMonthly(settings) / workdays;
}

/* ---------------- 加班薪资 ---------------- */

/** 常规时薪基准（不含加班倍率） */
export function baseHourlyRate(date: Date, settings: Settings): number {
  const hours = paidHoursPerDay(settings);
  if (hours <= 0) return 0;
  return dailyPay(date, settings) / hours;
}

/** 加班时薪（常规时薪 × 加班倍率） */
export function overtimeHourlyRate(date: Date, settings: Settings): number {
  return baseHourlyRate(date, settings) * settings.overtimeMultiplier;
}

/** 一条加班记录的加班费（元）；进行中的以 now 为截止实时累计 */
export function sessionPay(
  session: OvertimeSession,
  settings: Settings,
  now: Date = new Date(),
): number {
  const rate = overtimeHourlyRate(parseDateKey(session.date), settings);
  return (sessionSeconds(session, now) / 3600) * rate;
}

/** 某天的加班费合计（元） */
export function overtimePayOn(
  key: string,
  sessions: OvertimeSession[],
  settings: Settings,
  now: Date = new Date(),
): number {
  return sessionsOn(key, sessions).reduce((sum, s) => sum + sessionPay(s, settings, now), 0);
}

/* ---------------- 实时状态 ---------------- */

/**
 * 当前实时状态。
 *
 * 班次归属规则：跨午夜夜班（如 22:00-07:00）归属"上班那天"。
 * 因此 0 点之后要先看"昨天开始的班次是否仍在进行中"，而不是直接按今天的日期建班次，
 * 否则夜班会在午夜瞬间变成"还没开工/休息中"。
 */
export function computeDayState(
  now: Date,
  settings: Settings,
  sessions: OvertimeSession[] = [],
): DayState {
  const todayShift = buildShift(now, settings);
  const yday = startOfDay(now);
  yday.setDate(yday.getDate() - 1);
  const yesterdayShift = buildShift(yday, settings);

  // 覆盖当前时刻的班次（可能是昨天开始的夜班）
  const active: Shift | null =
    now >= todayShift.start && now < todayShift.end
      ? todayShift
      : now >= yesterdayShift.start && now < yesterdayShift.end
        ? yesterdayShift
        : null;

  // 时薪等展示口径：优先取进行中的班次，否则用今天的班次
  const refShift = active ?? todayShift;
  const pay = dailyPay(refShift.date, settings);
  const perHour = refShift.paidSeconds > 0 ? (pay / refShift.paidSeconds) * 3600 : 0;
  const base = {
    perSecond: perHour / 3600,
    perMinute: perHour / 60,
    perHour,
  } as const;

  /** 某天的加班费（进行中的实时累计） */
  const otPayOf = (d: Date) => overtimePayOn(dateKeyOf(d), sessions, settings, now);

  // 上班中 / 午休中（夜班跨午夜同样适用）
  if (active && dayKind(active.date, settings).workday) {
    const todayFull = pay;
    const overtimeEarned = otPayOf(active.date);
    const progressOf = (elapsed: number) =>
      active.paidSeconds > 0 ? Math.min(1, elapsed / active.paidSeconds) : 0;

    if (!settings.lunchPaid && active.lunch && now >= active.lunch.start && now < active.lunch.end) {
      const worked = paidElapsedSeconds(active, active.lunch.start, settings);
      const baseEarned = (perHour / 3600) * worked;
      return {
        ...base,
        isWorkday: true,
        status: "lunch",
        shiftDate: active.date,
        todayEarned: baseEarned + overtimeEarned,
        baseEarned,
        overtimeEarned,
        todayFull,
        progress: progressOf(worked),
        countdownSeconds: Math.ceil((active.lunch.end.getTime() - now.getTime()) / 1000),
        countdownLabel: "午休结束",
      };
    }

    const elapsed = paidElapsedSeconds(active, now, settings);
    const baseEarned = (perHour / 3600) * elapsed;
    return {
      ...base,
      isWorkday: true,
      status: "working",
      shiftDate: active.date,
      todayEarned: baseEarned + overtimeEarned,
      baseEarned,
      overtimeEarned,
      todayFull,
      progress: progressOf(elapsed),
      countdownSeconds: Math.ceil((active.end.getTime() - now.getTime()) / 1000),
      countdownLabel: "距离下班",
    };
  }

  const kind = dayKind(now, settings);

  if (!kind.workday) {
    const overtimeEarned = otPayOf(now);
    return {
      ...base,
      isWorkday: false,
      status: "restDay",
      shiftDate: now,
      todayEarned: overtimeEarned,
      baseEarned: 0,
      overtimeEarned,
      todayFull: 0,
      progress: 0,
      countdownSeconds: null,
      countdownLabel: "休息日 · 好好充电",
    };
  }

  if (now < todayShift.start) {
    const overtimeEarned = otPayOf(now);
    return {
      ...base,
      isWorkday: true,
      status: "beforeWork",
      shiftDate: now,
      todayEarned: overtimeEarned,
      baseEarned: 0,
      overtimeEarned,
      todayFull: pay,
      progress: 0,
      countdownSeconds: Math.ceil((todayShift.start.getTime() - now.getTime()) / 1000),
      countdownLabel: "距离上班",
    };
  }

  const overtimeEarned = otPayOf(now);
  return {
    ...base,
    isWorkday: true,
    status: "afterWork",
    shiftDate: now,
    todayEarned: pay + overtimeEarned,
    baseEarned: pay,
    overtimeEarned,
    todayFull: pay,
    progress: 1,
    countdownSeconds: null,
    countdownLabel: "今日已下班 · 辛苦了",
  };
}

/* ---------------- 本月累计 ---------------- */

/**
 * 本月已赚 = 本月已完成班次满额 + 进行中班次的实时已赚。
 * 班次按"归属日期"（上班那天）计入，跨午夜夜班不会重复计也不会漏计。
 */
export function monthEarnedToDate(
  now: Date,
  settings: Settings,
  sessions: OvertimeSession[] = [],
): number {
  const y = now.getFullYear();
  const m = now.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const mw = monthWorkdays(y, m, settings);
  const st = computeDayState(now, settings, sessions);

  const sDate = st.shiftDate;
  const sInMonth = sDate.getFullYear() === y && sDate.getMonth() === m;
  const sDay = sDate.getDate();

  let sum = 0;
  for (let d = 1; d <= days; d++) {
    const date = new Date(y, m, d);
    if (!dayKind(date, settings).workday) continue;
    if (!sInMonth) continue; // 班次归属上月（跨年夜班进行中）：本月暂无收益
    if (d < sDay) sum += dailyPay(date, settings, mw);
    else if (d === sDay) sum += st.baseEarned; // 归属日当天：按实时已赚，避免重复计满额
    // d > sDay：该班次尚未开始
  }

  // 加班费：本月截至今天（进行中的实时累计）
  const todayKey = dateKeyOf(now);
  const monthPrefix = `${y}-${String(m + 1).padStart(2, "0")}-`;
  for (const s of sessions) {
    if (s.date > todayKey) continue;
    if (!s.date.startsWith(monthPrefix)) continue;
    sum += sessionPay(s, settings, now);
  }

  return sum;
}

/* ---------------- 倒计时辅助 ---------------- */

/** 下一个发薪日（今天发薪则返回今天，days=0；发薪日大于当月天数时取当月最后一天） */
export function nextPayday(now: Date, payday: number): { date: Date; days: number } {
  const today = startOfDay(now);
  const p = Math.min(Math.max(Math.round(payday), 1), 31);

  const build = (year: number, month: number): Date => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(p, daysInMonth));
  };

  const thisMonth = build(today.getFullYear(), today.getMonth());
  if (thisMonth >= today) {
    return { date: thisMonth, days: Math.round((thisMonth.getTime() - today.getTime()) / 86400000) };
  }
  const nextMonth =
    today.getMonth() === 11
      ? build(today.getFullYear() + 1, 0)
      : build(today.getFullYear(), today.getMonth() + 1);
  return { date: nextMonth, days: Math.round((nextMonth.getTime() - today.getTime()) / 86400000) };
}

/** 下一个休息日（周末或法定假日） */
export function nextRestDay(now: Date, settings: Settings): { date: Date; days: number; name?: string } {
  const today = startOfDay(now);
  for (let i = 0; i < 60; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const kind = dayKind(d, settings);
    if (!kind.workday) return { date: d, days: i, name: kind.name };
  }
  return { date: today, days: 0 };
}

/** 数字金额格式化：4 位小数 */
export function fmtMoney(v: number, decimals = 4): string {
  return v.toLocaleString("zh-CN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

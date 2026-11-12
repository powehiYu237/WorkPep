import type { OvertimeSession } from "../types";

/* ---------------- 日期 / 时间工具 ---------------- */

/** Date -> "YYYY-MM-DD" */
export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" -> 当天 0 点的 Date */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 时间戳 -> "HH:mm" */
export function fmtClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "HH:mm" -> 当天分钟数 */
export function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 分钟数 -> "HH:mm"（自动对 24 小时取模） */
export function minToHM(min: number): string {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

/* ---------------- 加班记录计算 ---------------- */

/** 一条加班记录的时长（秒）；进行中的以 now 为截止 */
export function sessionSeconds(s: OvertimeSession, now: Date = new Date()): number {
  const end = s.endAt ?? now.getTime();
  return Math.max(0, (end - s.startAt) / 1000);
}

/** 某天的加班记录 */
export function sessionsOn(key: string, sessions: OvertimeSession[]): OvertimeSession[] {
  return sessions.filter((s) => s.date === key);
}

/** 某天的加班总时长（秒，进行中的算到现在） */
export function overtimeSecondsOn(key: string, sessions: OvertimeSession[], now: Date = new Date()): number {
  return sessionsOn(key, sessions).reduce((sum, s) => sum + sessionSeconds(s, now), 0);
}

/* ---------------- 展示格式化 ---------------- */

/** 计时器样式：01:23:45 / 05:12 */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 口语化时长：2小时15分 / 45分 / 30秒 */
export function fmtDurationCn(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}秒`;
  const mins = Math.round(s / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}小时${m}分`;
  if (h > 0) return `${h}小时`;
  return `${m}分`;
}

/** 一条加班记录的时间段文案：18:00 – 20:30 */
export function fmtSessionRange(s: OvertimeSession): string {
  const start = fmtClock(s.startAt);
  if (s.endAt === null) return `${start} – 现在`;
  const cross = dateKeyOf(new Date(s.startAt)) !== dateKeyOf(new Date(s.endAt));
  return `${start} – ${fmtClock(s.endAt)}${cross ? "（次日）" : ""}`;
}

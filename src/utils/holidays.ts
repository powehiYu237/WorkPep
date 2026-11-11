/**
 * 中国法定节假日数据（内置 2026 年，国务院 2025 年 11 月发布的安排）。
 *
 * ⚠️ 如官方安排有微调，直接改下面两张表即可，程序自动生效。
 * 数据结构：
 *  - HOLIDAYS：法定节假日放假日（当天即使不是周末也休息）
 *  - MAKEUP_WORKDAYS：调休补班日（当天即使是周末也要上班）
 */

export interface HolidayGroup {
  name: string;
  /** 完整日期列表，"YYYY-MM-DD" */
  dates: string[];
}

const range = (year: number, startM: number, startD: number, endM: number, endD: number): string[] => {
  const out: string[] = [];
  const d = new Date(year, startM - 1, startD);
  const end = new Date(year, endM - 1, endD);
  while (d <= end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
};

/** 放假日 */
export const HOLIDAYS: Record<number, HolidayGroup[]> = {
  2026: [
    { name: "元旦", dates: range(2026, 1, 1, 1, 1) },
    { name: "春节", dates: range(2026, 2, 15, 2, 22) },
    { name: "清明节", dates: range(2026, 4, 4, 4, 6) },
    { name: "劳动节", dates: range(2026, 5, 1, 5, 5) },
    { name: "端午节", dates: range(2026, 6, 19, 6, 21) },
    { name: "中秋节", dates: range(2026, 9, 25, 9, 27) },
    { name: "国庆节", dates: range(2026, 10, 1, 10, 7) },
  ],
};

/** 调休补班日（周末但要上班） */
export const MAKEUP_WORKDAYS: Record<number, HolidayGroup[]> = {
  2026: [
    { name: "春节调休", dates: ["2026-02-14", "2026-02-28"] },
    { name: "劳动节调休", dates: ["2026-04-26", "2026-05-09"] },
    { name: "国庆节调休", dates: ["2026-10-10"] },
  ],
};

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 某年是否有节假日数据（没有则周末/调休判定会失真，UI 应提示更新） */
export function hasHolidayData(year: number): boolean {
  const g = HOLIDAYS[year];
  return Array.isArray(g) && g.length > 0;
}

/** 判断某天是否法定假日 / 调休补班 */
export function lookupHoliday(d: Date): { holiday?: string; makeup?: string } {
  const key = dateKey(d);
  const year = d.getFullYear();
  const res: { holiday?: string; makeup?: string } = {};

  const hol = HOLIDAYS[year];
  if (hol) {
    for (const g of hol) {
      if (g.dates.includes(key)) {
        res.holiday = g.name;
        break;
      }
    }
  }
  const mk = MAKEUP_WORKDAYS[year];
  if (mk) {
    for (const g of mk) {
      if (g.dates.includes(key)) {
        res.makeup = g.name;
        break;
      }
    }
  }
  return res;
}

/** 未来 N 天内的法定假日（含今天），用于节假日倒计时 */
export function upcomingHolidays(from: Date, limitDays = 400): { name: string; date: Date; days: number }[] {
  const out: { name: string; date: Date; days: number }[] = [];
  for (const year of Object.keys(HOLIDAYS).map(Number).sort()) {
    for (const g of HOLIDAYS[year]) {
      const first = g.dates[0];
      const [y, m, dd] = first.split("-").map(Number);
      const date = new Date(y, m - 1, dd);
      const days = Math.ceil((date.getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / 86400000);
      if (days >= 0 && days <= limitDays) {
        out.push({ name: g.name, date, days });
      }
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

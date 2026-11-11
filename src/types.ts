/** 薪资输入模式 */
export type SalaryMode = "month" | "year" | "hour";

/** 休息模式：双休 / 单休 / 大小周 */
export type RestPattern = "double" | "single" | "alternate";

/** 全局设置（持久化到 localStorage） */
export interface Settings {
  salaryMode: SalaryMode;
  /** 月薪（salaryMode === "month" 时生效） */
  monthlySalary: number;
  /** 年薪（salaryMode === "year" 时生效，按 12 个月折算） */
  annualSalary: number;
  /** 时薪（salaryMode === "hour" 时生效） */
  hourSalary: number;
  restPattern: RestPattern;
  /** 上班时间 "HH:mm" */
  workStart: string;
  /** 下班时间 "HH:mm"，支持跨午夜（夜班） */
  workEnd: string;
  /** 午休开始 "HH:mm" */
  lunchStart: string;
  /** 午休结束 "HH:mm" */
  lunchEnd: string;
  /** 午休期间是否计薪 */
  lunchPaid: boolean;
  /** 发薪日（每月几号，1-31） */
  payday: number;
}

/** 一天中的实时状态 */
export interface DayState {
  status: "beforeWork" | "working" | "lunch" | "afterWork" | "restDay";
  /** 今日是否为工作日 */
  isWorkday: boolean;
  /** 当前班次归属日期（跨午夜夜班可能是昨天） */
  shiftDate: Date;
  /** 今日已赚（元） */
  todayEarned: number;
  /** 今日应赚满额（元） */
  todayFull: number;
  /** 今日进度 0-1 */
  progress: number;
  /** 每秒收益 */
  perSecond: number;
  /** 每分钟收益 */
  perMinute: number;
  /** 每小时收益 */
  perHour: number;
  /** 倒计时目标秒数（null 表示无倒计时） */
  countdownSeconds: number | null;
  /** 倒计时标签 */
  countdownLabel: string;
}

/** 工作日/休息日判定结果 */
export interface DayKind {
  workday: boolean;
  /** 原因：weekday / weekend / holiday / makeup */
  reason: "weekday" | "weekend" | "holiday" | "makeup";
  /** 命中的节假日名称 */
  name?: string;
}

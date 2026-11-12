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
  /** 加班工资倍率（如 1.5 表示 1.5 倍时薪） */
  overtimeMultiplier: number;
}

/** 一条加班记录（持久化） */
export interface OvertimeSession {
  id: string;
  /** 加班归属日期 "YYYY-MM-DD"（开始加班那天） */
  date: string;
  /** 开始时刻（毫秒时间戳） */
  startAt: number;
  /** 结束时刻（毫秒时间戳）；null 表示正在进行中 */
  endAt: number | null;
  /** live = 加班按钮实时计时；manual = 事后补录 */
  source: "live" | "manual";
  /** 备注（补录时可填） */
  note?: string;
}

/** 一天中的实时状态 */
export interface DayState {
  status: "beforeWork" | "working" | "lunch" | "afterWork" | "restDay";
  /** 今日是否为工作日 */
  isWorkday: boolean;
  /** 当前班次归属日期（跨午夜夜班可能是昨天） */
  shiftDate: Date;
  /** 今日已赚（元，含加班费） */
  todayEarned: number;
  /** 今日基本工资已赚（元，不含加班） */
  baseEarned: number;
  /** 今日加班费已赚（元） */
  overtimeEarned: number;
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

// History and statistics (docs/app/features/statistics.md): computed on the device
// from the events, like exams and learning.
import type { AppEvent, ContentPackage } from "./api";
import { examEvents, exams, score, type Exam, type Result } from "./exam";
import { practiceEvents } from "./learning";

export interface Attempt {
  exam: Exam;
  // Only for submitted exams.
  result?: Result;
  minutes: number;
}

// Finished exams (submitted or abandoned), newest first, optionally of one type.
export function attempts(events: AppEvent[], content: ContentPackage, examType?: string): Attempt[] {
  return exams(events)
    .filter((e) => e.status !== "active" && (!examType || e.examType === examType))
    .map((exam) => ({
      exam,
      result: exam.status === "submitted" ? score(exam, content) : undefined,
      minutes: Math.max(1, Math.round((Math.min(exam.finishedAt!, exam.deadline) - exam.startedAt) / 60_000)),
    }))
    .sort((a, b) => b.exam.startedAt - a.exam.startedAt);
}

export interface ExamSummary {
  taken: number;
  passed: number;
  passRate: number;
  // Average percentage of the last 5 exams.
  recentAverage: number;
  best: number;
}

export const recentCount = 5;

export function summary(list: Attempt[]): ExamSummary | undefined {
  const done = list.filter((a) => a.result);
  if (done.length === 0) return undefined;
  const passed = done.filter((a) => a.result!.passed).length;
  const recent = done.slice(0, recentCount);
  return {
    taken: done.length,
    passed,
    passRate: Math.round((passed * 100) / done.length),
    recentAverage: Math.round(recent.reduce((n, a) => n + a.result!.percent, 0) / recent.length),
    best: Math.max(...done.map((a) => a.result!.percent)),
  };
}

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export interface Practice {
  answers: number;
  right: number;
  // Consecutive days with any answer, ending today (or yesterday).
  streak: number;
  // Practice answers per day, oldest first, the last one today.
  perDay: { day: Date; answers: number }[];
}

export const activityDays = 14;

export function practice(events: AppEvent[], now = Date.now()): Practice {
  const studied = new Set<string>();
  const byDay = new Map<string, number>();
  let answers = 0;
  let right = 0;
  for (const e of events) {
    const t = Date.parse(e.at);
    if (e.type === practiceEvents.answered) {
      answers++;
      if (e.data.correct === true) right++;
      byDay.set(dayKey(t), (byDay.get(dayKey(t)) ?? 0) + 1);
      studied.add(dayKey(t));
    } else if (e.type === examEvents.answered) {
      studied.add(dayKey(t));
    }
  }
  const day = (back: number) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - back);
    return d;
  };
  let back = studied.has(dayKey(now)) ? 0 : 1;
  let streak = 0;
  while (studied.has(dayKey(day(back).getTime()))) {
    streak++;
    back++;
  }
  const perDay = [];
  for (let i = activityDays - 1; i >= 0; i--) {
    const d = day(i);
    perDay.push({ day: d, answers: byDay.get(dayKey(d.getTime())) ?? 0 });
  }
  return { answers, right, streak, perDay };
}

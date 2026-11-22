// Learning logic: the user's answer history, coverage per subject and the mistakes
// to practise. Like exams, it runs on the device from the content package and the
// events (see docs/app/features/learning-and-review.md).
import type { AppEvent, ContentPackage, Question, Subject } from "./api";
import { exams } from "./exam";

export const practiceEvents = {
  answered: "practice.answered",
} as const;

export type PracticeMode = "learn" | "mistakes";

// One answer to a question, in an exam or in practice.
interface Attempt {
  group: string;
  correct: boolean;
  at: number;
}

// What the user did with a question (and its equivalents).
export interface History {
  lastCorrect: boolean;
  wrongCount: number;
  lastWrongAt: number;
}

const groupOf = (q: Question) => q.group ?? q.id;

// The questions of the exam types, one per group of equivalent questions, in the
// content's order (a question shared by several exam types counts once), optionally
// only the ones of a subject.
export function questionsOf(content: ContentPackage, examTypeIds: string[], subject?: string): Question[] {
  const ids = content.examTypes.filter((t) => examTypeIds.includes(t.id)).flatMap((t) => t.questionIds ?? []);
  const byId = new Map(content.questions.map((q) => [q.id, q]));
  const groups = new Set<string>();
  const out: Question[] = [];
  for (const id of ids) {
    const q = byId.get(id);
    if (!q || (subject && q.subject !== subject) || groups.has(groupOf(q))) continue;
    groups.add(groupOf(q));
    out.push(q);
  }
  return out;
}

// Every answer that counts: practice answers, and the answers of submitted exams
// (as of their submission). Unanswered questions don't count.
function attempts(events: AppEvent[], content: ContentPackage): Attempt[] {
  const byId = new Map(content.questions.map((q) => [q.id, q]));
  const out: Attempt[] = [];
  for (const exam of exams(events)) {
    if (exam.status !== "submitted") continue;
    for (const [id, answer] of Object.entries(exam.answers)) {
      const q = byId.get(id);
      if (q) out.push({ group: groupOf(q), correct: q.answers[answer]?.correct ?? false, at: exam.finishedAt! });
    }
  }
  for (const e of events) {
    if (e.type !== practiceEvents.answered) continue;
    const q = byId.get(e.data.questionId as string);
    if (q) out.push({ group: groupOf(q), correct: e.data.correct === true, at: Date.parse(e.at) });
  }
  return out.sort((a, b) => a.at - b.at);
}

// The history of every question answered at least once, by group.
export function histories(events: AppEvent[], content: ContentPackage): Map<string, History> {
  const out = new Map<string, History>();
  for (const a of attempts(events, content)) {
    const h = out.get(a.group) ?? { lastCorrect: false, wrongCount: 0, lastWrongAt: 0 };
    h.lastCorrect = a.correct;
    if (!a.correct) {
      h.wrongCount++;
      h.lastWrongAt = a.at;
    }
    out.set(a.group, h);
  }
  return out;
}

export const historyOf = (h: Map<string, History>, q: Question) => h.get(groupOf(q));

export interface SubjectProgress {
  subject: Subject;
  total: number;
  seen: number;
  mastered: number;
  mistakes: number;
  weak: boolean;
}

// A subject is weak once enough of it has been answered and too little is mastered.
export const weakAfter = 5;

// The pass mark that counts for the exam types: the highest of them.
export function passPercentOf(content: ContentPackage, examTypeIds: string[]): number {
  return Math.max(0, ...content.examTypes.filter((t) => examTypeIds.includes(t.id)).map((t) => t.format?.passPercent ?? 0));
}

export function progress(content: ContentPackage, examTypeIds: string[], h: Map<string, History>): SubjectProgress[] {
  const passPercent = passPercentOf(content, examTypeIds);
  const out: SubjectProgress[] = [];
  for (const subject of content.subjects) {
    const qs = questionsOf(content, examTypeIds, subject.id);
    if (qs.length === 0) continue;
    let seen = 0;
    let mastered = 0;
    for (const q of qs) {
      const x = historyOf(h, q);
      if (!x) continue;
      seen++;
      if (x.lastCorrect) mastered++;
    }
    out.push({
      subject,
      total: qs.length,
      seen,
      mastered,
      mistakes: seen - mastered,
      weak: seen >= weakAfter && mastered * 100 < passPercent * seen,
    });
  }
  return out;
}

// The questions whose last answer was wrong: the most often wrong first, then the
// most recent mistakes.
export function mistakes(content: ContentPackage, examTypeIds: string[], h: Map<string, History>): Question[] {
  return questionsOf(content, examTypeIds)
    .filter((q) => historyOf(h, q)?.lastCorrect === false)
    .sort((a, b) => {
      const x = historyOf(h, a)!;
      const y = historyOf(h, b)!;
      return y.wrongCount - x.wrongCount || y.lastWrongAt - x.lastWrongAt;
    });
}

// Where a learning session starts: the first question not seen yet, or the first
// one when all have been seen.
export function learningStart(questions: Question[], h: Map<string, History>): number {
  const i = questions.findIndex((q) => !historyOf(h, q));
  return i < 0 ? 0 : i;
}

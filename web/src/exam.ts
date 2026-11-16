// Exam logic. It runs on the device, on the content package and the user's events,
// so exams work offline (see docs/app/features/exam-simulation.md).
import type { Answer, AppEvent, ContentPackage, Question } from "./api";

export const examEvents = {
  started: "exam.started",
  answered: "exam.answered",
  submitted: "exam.submitted",
  abandoned: "exam.abandoned",
} as const;

export interface ExamQuestion {
  id: string;
  // The question's answer indices in the order they're shown.
  order: number[];
}

export interface Exam {
  id: string;
  examType: string;
  startedAt: number;
  deadline: number;
  passPercent: number;
  questions: ExamQuestion[];
  // Question ID to the chosen answer's index in the question.
  answers: Record<string, number>;
  status: "active" | "submitted" | "abandoned";
  // When it was submitted or abandoned.
  finishedAt?: number;
  timedOut: boolean;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// The data of a new exam's "started" event: a random set of the exam type's
// questions, at most one per group of equivalent questions, with shuffled answers.
export function newExam(content: ContentPackage, examTypeId: string, examId: string, random = Math.random) {
  const type = content.examTypes.find((t) => t.id === examTypeId);
  if (!type?.format || !type.questionIds) throw new Error(`exam type ${examTypeId} has no exam`);
  const byId = new Map(content.questions.map((q) => [q.id, q]));
  const groups = new Set<string>();
  const questions: ExamQuestion[] = [];
  for (const id of shuffle(type.questionIds, random)) {
    const q = byId.get(id);
    if (!q) continue;
    const group = q.group ?? q.id;
    if (groups.has(group)) continue;
    groups.add(group);
    questions.push({ id, order: shuffle(q.answers.map((_, i) => i), random) });
    if (questions.length === type.format.questions) break;
  }
  return {
    examId,
    examType: type.id,
    contentVersion: content.version,
    minutes: type.format.minutes,
    passPercent: type.format.passPercent,
    questions,
  };
}

// Rebuilds the user's exams from their events, oldest first. Exams are created from
// their "started" events first, so an event recorded in the same millisecond as the
// start still applies, whatever order equal times come in.
export function exams(events: AppEvent[]): Exam[] {
  const byId = new Map<string, Exam>();
  for (const e of events) {
    const d = e.data as Record<string, any>;
    const at = Date.parse(e.at);
    if (e.type === examEvents.started) {
      if (byId.has(d.examId)) continue;
      byId.set(d.examId, {
        id: d.examId,
        examType: d.examType,
        startedAt: at,
        deadline: at + d.minutes * 60_000,
        passPercent: d.passPercent,
        questions: d.questions,
        answers: {},
        status: "active",
        timedOut: false,
      });
    }
  }
  for (const e of events) {
    const d = e.data as Record<string, any>;
    const at = Date.parse(e.at);
    const exam = byId.get(d.examId);
    if (e.type === examEvents.started || !exam || exam.status !== "active") continue;
    if (e.type === examEvents.answered && at <= exam.deadline) {
      exam.answers[d.questionId] = d.answer;
    } else if (e.type === examEvents.submitted) {
      exam.status = "submitted";
      exam.finishedAt = at;
      exam.timedOut = d.reason === "timeout";
    } else if (e.type === examEvents.abandoned) {
      exam.status = "abandoned";
      exam.finishedAt = at;
    }
  }
  return [...byId.values()];
}

// The exam in progress, if any: the latest one started and not finished.
export function activeExam(events: AppEvent[]): Exam | undefined {
  return exams(events)
    .filter((e) => e.status === "active")
    .at(-1);
}

export interface WrongAnswer {
  question: Question;
  given?: Answer;
  correct: Answer;
}

export interface Result {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  wrong: WrongAnswer[];
}

export function score(exam: Exam, content: ContentPackage): Result {
  const byId = new Map(content.questions.map((q) => [q.id, q]));
  const wrong: WrongAnswer[] = [];
  let correct = 0;
  for (const { id } of exam.questions) {
    const q = byId.get(id);
    if (!q) continue;
    const given = exam.answers[id];
    if (given !== undefined && q.answers[given]?.correct) {
      correct++;
    } else {
      wrong.push({ question: q, given: given === undefined ? undefined : q.answers[given], correct: q.answers.find((a) => a.correct)! });
    }
  }
  const total = exam.questions.length;
  return {
    correct,
    total,
    percent: Math.round((correct * 100) / total),
    passed: correct * 100 >= exam.passPercent * total,
    wrong,
  };
}

// Backend API on the same origin.
export interface Me {
  id: string;
  email: string;
  roles: string[];
}

export interface ExamFormat {
  questions: number;
  minutes: number;
  passPercent: number;
  confirmed: boolean;
}

export interface ExamType {
  id: string;
  name: string;
  description: string;
  available: boolean;
  format?: ExamFormat;
}

export interface Answer {
  text: string;
  correct: boolean;
}

export interface Question {
  id: string;
  text: string;
  answers: Answer[];
  revision: number;
  subject: string;
  // Shared by equivalent questions.
  group?: string;
}

// The content the app downloads and runs exams on, on the device.
export interface ContentPackage {
  version: string;
  questions: Question[];
  examTypes: (ExamType & { questionIds?: string[] })[];
}

// One thing the user did, recorded on the device and synced to the server.
export interface AppEvent {
  id: string;
  type: string;
  // ISO 8601
  at: string;
  data: Record<string, unknown>;
}

export interface Profile {
  // Empty until the user has chosen one.
  examType: string;
}

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`${what}: ${res.status}`);
  return res.json();
}

// Returns the signed-in account, or null when signed out.
export async function getMe(): Promise<Me | null> {
  const res = await fetch("/api/me", { credentials: "include" });
  if (res.status === 401) return null;
  return json(res, "/api/me");
}

export async function getExamTypes(): Promise<ExamType[]> {
  return json(await fetch("/api/exam-types"), "/api/exam-types");
}

export async function getProfile(): Promise<Profile> {
  return json(await fetch("/api/profile", { credentials: "include" }), "/api/profile");
}

export async function setExamType(examType: string): Promise<Profile> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ examType }),
  });
  return json(res, "/api/profile");
}

export async function getContent(): Promise<ContentPackage> {
  return json(await fetch("/api/content"), "/api/content");
}

export async function getEvents(): Promise<AppEvent[]> {
  return json(await fetch("/api/events", { credentials: "include" }), "/api/events");
}

export async function postEvents(events: AppEvent[]): Promise<void> {
  const res = await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ events }),
  });
  await json(res, "/api/events");
}

// A passage of a bibliography document.
export interface Passage {
  source: string;
  page: number;
  reference: string;
  quote: string;
}

// A question's explanation as users see it, with reviews applied.
export interface Explanation extends Passage {
  questionId: string;
  status: "suggested" | "verified" | "stale" | "rejected";
  sourceTitle: string;
  flagged?: boolean;
  flagNote?: string;
  // For reviewers only.
  concern?: string;
  note?: string;
}

export async function getExplanations(): Promise<Explanation[]> {
  return json(await fetch("/api/explanations", { credentials: "include" }), "/api/explanations");
}

export type ReviewAction = "confirm" | "reject" | "correct" | "flag" | "reset";

export class ReviewError extends Error {
  constructor(public status: number) {
    super(`review: ${status}`);
  }
}

export async function postReview(review: {
  id: string;
  questionId: string;
  action: ReviewAction;
  note?: string;
  correction?: Passage;
}): Promise<Explanation> {
  const res = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(review),
  });
  if (!res.ok) throw new ReviewError(res.status);
  return res.json();
}

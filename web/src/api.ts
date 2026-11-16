// Backend API on the same origin.
export interface Me {
  id: string;
  email: string;
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

// Helpers for explanations and reviews. Reviews change what every user sees, so a
// test that reviews an explanation first claims one no other running test uses,
// and removes its reviews afterwards (see "Parallel tests within a branch" in
// docs/DEVELOPMENT.md). Only R.N.D. explanations are claimed; tests that only read
// explanations use COLREG ones, which reviews never touch.
import { expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { stackEnv } from "../stack";
import { createAccount, uniqueEmail } from "./helpers";

export interface Explanation {
  questionId: string;
  status: "suggested" | "verified" | "stale" | "rejected";
  source: string;
  sourceTitle: string;
  page: number;
  reference: string;
  quote: string;
  flagged?: boolean;
}

export async function explanations(page: Page): Promise<Explanation[]> {
  const res = await page.request.get("/api/explanations");
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// Creates an account and gives it the reviewer role through the server's own
// grant-role command, in this stack's app container.
export async function createReviewer(): Promise<string> {
  const email = await createAccount(uniqueEmail());
  execFileSync("docker", ["exec", `${stackEnv().STACK_PROJECT}-app-1`, "/server", "grant-role", "-email", email, "-role", "reviewer"]);
  return email;
}

async function withDB<T>(f: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: stackEnv().DATABASE_URL });
  await db.connect();
  try {
    return await f(db);
  } finally {
    await db.end();
  }
}

// Claims a suggested R.N.D. explanation for the calling test and returns its question ID.
export async function claimExplanation(candidates: Explanation[]): Promise<string> {
  const ids = candidates.filter((e) => e.status === "suggested" && e.source === "rnd").map((e) => e.questionId);
  return withDB(async (db) => {
    await db.query("CREATE TABLE IF NOT EXISTS e2e_claims (question_id text PRIMARY KEY, claimed_at timestamptz NOT NULL DEFAULT now())");
    const res = await db.query(
      `INSERT INTO e2e_claims (question_id)
         SELECT id FROM unnest($1::text[]) AS id WHERE id NOT IN (SELECT question_id FROM e2e_claims)
         ORDER BY random() LIMIT 1
       ON CONFLICT DO NOTHING RETURNING question_id`,
      [ids],
    );
    if (res.rowCount !== 1) throw new Error("no unclaimed explanation left");
    return res.rows[0].question_id as string;
  });
}

// Removes the reviews of a claimed explanation and releases it.
export async function releaseExplanation(questionId: string) {
  await withDB(async (db) => {
    await db.query("DELETE FROM reviews WHERE question_id = $1", [questionId]);
    await db.query("DELETE FROM e2e_claims WHERE question_id = $1", [questionId]);
  });
}

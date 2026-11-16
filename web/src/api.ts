// Backend API on the same origin.
export interface Me {
  id: string;
  email: string;
}

// Returns the signed-in account, or null when signed out.
export async function getMe(): Promise<Me | null> {
  const res = await fetch("/api/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`/api/me: ${res.status}`);
  return res.json();
}

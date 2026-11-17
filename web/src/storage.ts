// Device storage. Storage can be unavailable (private mode, blocked site data);
// the app then works for the current page only.
export function load<T>(key: string): T | undefined {
  try {
    const text = localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not stored on the device; the server still gets it on the next sync.
  }
}

export function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
}

// A random UUID; crypto.randomUUID needs a secure context, which a home server on
// plain HTTP isn't.
export function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function normalizeEmail(value: string) {
  return String(value ?? "").trim().toLowerCase();
}
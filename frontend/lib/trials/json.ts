export function normalizePossiblyEncodedJson<T>(
  value: unknown,
  maxDepth = 2,
): T | null {
  if (!value) return null;

  let parsed: unknown = value;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (typeof parsed !== "string") break;

    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    return parsed as T;
  }

  return null;
}

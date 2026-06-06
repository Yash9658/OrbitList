const VERBATIM_FIELD_NAMES = new Set([
  "password",
  "currentPassword",
  "nextPassword",
  "contentBase64"
]);

function stripControlCharacters(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function sanitizeFreeText(value: string) {
  return normalizeWhitespace(stripHtmlTags(stripControlCharacters(value)));
}

function shouldKeepVerbatim(path: string[]) {
  const lastSegment = path[path.length - 1];
  return Boolean(lastSegment && VERBATIM_FIELD_NAMES.has(lastSegment));
}

export function sanitizeForValidation<T>(value: T, path: string[] = []): T {
  if (typeof value === "string") {
    if (shouldKeepVerbatim(path)) {
      return value;
    }

    return sanitizeFreeText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeForValidation(item, [...path, String(index)])
    ) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sanitizeForValidation(nestedValue, [...path, key])
      ])
    ) as T;
  }

  return value;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_FIRST_NAME_LENGTH = 50;
export const MAX_REASON_LENGTH = 280;
export const MAX_COMMUNITY_POST_LENGTH = 500;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function sanitizeText(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeMultilineText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function clampLength(input: string, max: number): string {
  return input.length > max ? input.slice(0, max) : input;
}

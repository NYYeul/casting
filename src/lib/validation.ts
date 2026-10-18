export function requiredText(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function safeUrl(value: unknown) {
  const text = requiredText(value, 1000);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export const UPLOAD_PATTERN = /^\/api\/uploads\/[a-f0-9-]{36}\.(jpg|png|webp|pdf)$/;
const AVATAR_PATTERN = /^\/avatars\/p\d{2}\.svg$/;

export function safeImageRef(value: unknown) {
  const text = requiredText(value, 1000);
  return UPLOAD_PATTERN.test(text) || AVATAR_PATTERN.test(text) ? text : safeUrl(text);
}

export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

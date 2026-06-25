export const ENTRY_CODE_SUFFIX_MIN_LENGTH = 2;
export const ENTRY_CODE_SUFFIX_MAX_LENGTH = 12;
export const ENTRY_CODE_MIN_LENGTH = 6;
export const ENTRY_CODE_MAX_LENGTH = 16;

export function getCurrentYearPrefix() {
  return String(new Date().getFullYear());
}

export function sanitizeEntryCodeSuffixInput(value: string) {
  return value.replace(/\s/g, "");
}

export function sanitizeEntryCodeInput(value: string) {
  return value.replace(/\s/g, "");
}

export function getEntryCodeValidationMessage(code: string): string | null {
  const normalized = sanitizeEntryCodeInput(code).trim();
  if (!normalized) {
    return "입장코드를 입력해 주세요.";
  }
  if (/\s/.test(code)) {
    return "입장코드에는 공백을 사용할 수 없습니다.";
  }
  if (normalized.length < ENTRY_CODE_MIN_LENGTH) {
    return `입장코드는 ${ENTRY_CODE_MIN_LENGTH}자 이상 입력해 주세요.`;
  }
  if (normalized.length > ENTRY_CODE_MAX_LENGTH) {
    return `입장코드는 ${ENTRY_CODE_MAX_LENGTH}자 이내로 입력해 주세요.`;
  }
  if (!/^\d{4}/.test(normalized)) {
    return "입장코드는 연도 4자리로 시작해야 합니다.";
  }
  return null;
}

export function getEntryCodeSuffixValidationMessage(suffix: string): string | null {
  const normalized = suffix.trim();
  if (!normalized) {
    return "입장코드 식별 문자를 입력해 주세요.";
  }
  if (/\s/.test(normalized)) {
    return "입장코드에는 공백을 사용할 수 없습니다.";
  }
  if (normalized.length < ENTRY_CODE_SUFFIX_MIN_LENGTH) {
    return `입장코드 식별 문자는 ${ENTRY_CODE_SUFFIX_MIN_LENGTH}자 이상 입력해 주세요.`;
  }
  if (normalized.length > ENTRY_CODE_SUFFIX_MAX_LENGTH) {
    return `입장코드 식별 문자는 ${ENTRY_CODE_SUFFIX_MAX_LENGTH}자 이내로 입력해 주세요.`;
  }
  return null;
}

export function buildEntryCodePreview(suffix: string) {
  return `${getCurrentYearPrefix()}${suffix.trim()}`;
}

export function isEntryCodeServerErrorMessage(message: string): boolean {
  return message.includes("입장코드") || message.startsWith("이미 사용 중인");
}

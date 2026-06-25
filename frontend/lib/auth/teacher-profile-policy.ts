import { validateOptionalEmail } from "@/lib/auth/email-policy";
import type { UserProfile } from "@/lib/auth/types";

export const SCHOOL_NAME_MAX_LENGTH = 200;

export function getSchoolNameValidationMessage(schoolName: string): string | null {
  const trimmed = schoolName.trim();
  if (!trimmed) {
    return "지도자 신청을 위해 소속(학교/기관)을 입력해 주세요.";
  }
  if (trimmed.length > SCHOOL_NAME_MAX_LENGTH) {
    return `소속은 ${SCHOOL_NAME_MAX_LENGTH}자 이내로 입력해 주세요.`;
  }
  return null;
}

export function getTeacherProfileValidationMessage(user: Pick<UserProfile, "name" | "email">): string | null {
  const name = user.name?.trim() ?? "";
  if (!name) {
    return "지도자 신청을 위해 이름을 등록해 주세요.";
  }

  const email = user.email?.trim() ?? "";
  if (!email) {
    return "지도자 신청을 위해 이메일을 등록해 주세요.";
  }

  return validateOptionalEmail(email);
}

export function hasTeacherContactProfile(user: Pick<UserProfile, "name" | "email">) {
  return getTeacherProfileValidationMessage(user) === null;
}

import { MemberAuthProviderBadge } from "@/app/(admin)/_components/admin-badge";
import { AdminFormRow, AdminFormTable } from "@/app/(admin)/_components/admin-form-row";
import { AdminInput } from "@/app/(admin)/_components/admin-input";
import { AdminSelect } from "@/app/(admin)/_components/admin-select";
import type { MemberListItem } from "@/app/(admin)/admin/(dashboard)/users/_types";

type MemberPanelFormProps = {
  member: MemberListItem;
};

const panelInputClassName =
  "h-11 rounded-lg border-[#D6D0C6] bg-white text-sm focus:border-[#2A4232] focus:ring-4 focus:ring-[#2A4232]/10";

export function MemberPanelForm({ member }: MemberPanelFormProps) {
  const isGoogle = member.auth_provider === "google";

  return (
    <AdminFormTable>
      <AdminFormRow label="가입 방식">
        <MemberAuthProviderBadge authProvider={member.auth_provider} />
      </AdminFormRow>

      <AdminFormRow htmlFor="member-id" label="ID">
        <AdminInput
          className={panelInputClassName}
          defaultValue={member.id}
          disabled
          id="member-id"
          name="id"
          readOnly
          type="text"
        />
      </AdminFormRow>

      <AdminFormRow htmlFor="member-login-id" label="아이디">
        <AdminInput
          className={panelInputClassName}
          defaultValue={member.login_id ?? ""}
          disabled
          id="member-login-id"
          name="login_id"
          readOnly
          type="text"
        />
      </AdminFormRow>

      <AdminFormRow htmlFor="member-name" label="이름">
        <AdminInput
          className={panelInputClassName}
          defaultValue={member.name ?? ""}
          id="member-name"
          maxLength={100}
          name="name"
          placeholder="이름"
          type="text"
        />
      </AdminFormRow>

      <AdminFormRow htmlFor="member-email" label="이메일">
        <AdminInput
          className={panelInputClassName}
          defaultValue={member.email ?? ""}
          disabled={isGoogle}
          id="member-email"
          maxLength={255}
          name="email"
          placeholder={isGoogle ? "구글 연동 이메일" : "이메일"}
          type="email"
        />
      </AdminFormRow>

      <AdminFormRow htmlFor="member-nickname" label="닉네임">
        <AdminInput
          className={panelInputClassName}
          defaultValue={member.nickname ?? ""}
          id="member-nickname"
          maxLength={100}
          name="nickname"
          placeholder="닉네임"
          type="text"
        />
      </AdminFormRow>

      <AdminFormRow htmlFor="member-grade" label="등급" required>
        <AdminSelect
          className={`${panelInputClassName} h-11`}
          defaultValue={member.grade}
          id="member-grade"
          name="grade"
          required
        >
          <option value="student">학생</option>
          <option value="teacher">지도자</option>
        </AdminSelect>
      </AdminFormRow>

      {!isGoogle ? (
        <AdminFormRow htmlFor="member-password" label="비밀번호 변경">
          <AdminInput
            className={panelInputClassName}
            id="member-password"
            maxLength={128}
            minLength={8}
            name="password"
            placeholder="변경 시에만 입력"
            type="password"
          />
        </AdminFormRow>
      ) : null}
    </AdminFormTable>
  );
}

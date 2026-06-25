"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminFilterRow } from "@/app/(admin)/_components/admin-active-filter";
import { AdminInput } from "@/app/(admin)/_components/admin-input";
import { AdminPanelFooter } from "@/app/(admin)/_components/admin-panel-footer";
import {
  AdminPagination,
  type AdminPageSize,
} from "@/app/(admin)/_components/admin-pagination";
import { AdminPageHeader } from "@/app/(admin)/_components/admin-page-header";
import { AdminSelect } from "@/app/(admin)/_components/admin-select";
import { AdminSlidePanel } from "@/app/(admin)/_components/admin-slide-panel";
import {
  useAdminMembers,
  useDeleteAdminMember,
  useUpdateAdminMember,
} from "@/app/(admin)/_hooks/use-admin-members";
import { AdminApiError } from "@/app/(admin)/_lib/admin-api";
import { MemberPanelForm } from "@/app/(admin)/admin/(dashboard)/users/_components/member-panel-form";
import { MemberTable } from "@/app/(admin)/admin/(dashboard)/users/_components/member-table";
import type {
  MemberAuthProviderFilter,
  MemberGradeFilter,
  MemberListFilters,
  MemberListItem,
} from "@/app/(admin)/admin/(dashboard)/users/_types";

const emptyFilters: MemberListFilters = {
  grade: "all",
  authProvider: "all",
  loginId: "",
  name: "",
  email: "",
};

const filterInputClassName =
  "h-11 rounded-lg border-[#D6D0C6] bg-white text-sm focus:border-[#2A4232] focus:ring-4 focus:ring-[#2A4232]/10";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function UsersPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedMember, setSelectedMember] = useState<MemberListItem | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<AdminPageSize>(20);
  const [gradeFilter, setGradeFilter] = useState<MemberGradeFilter>("all");
  const [authProviderFilter, setAuthProviderFilter] = useState<MemberAuthProviderFilter>("all");
  const [loginIdQuery, setLoginIdQuery] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [emailQuery, setEmailQuery] = useState("");
  const [submittedFilters, setSubmittedFilters] = useState<MemberListFilters>(emptyFilters);
  const [panelError, setPanelError] = useState("");

  const membersQuery = useAdminMembers(page, pageSize, submittedFilters);
  const updateMember = useUpdateAdminMember();
  const deleteMember = useDeleteAdminMember();

  const members = membersQuery.data?.items ?? [];
  const total = membersQuery.data?.total ?? 0;
  const totalPages = membersQuery.data?.total_pages ?? 0;
  const isLoading = membersQuery.isPending;
  const isRefreshing = membersQuery.isFetching && !membersQuery.isPending;
  const isSaving = updateMember.isPending;
  const isDeleting = deleteMember.isPending;
  const pageError = membersQuery.error?.message ?? "";

  useEffect(() => {
    if (membersQuery.error instanceof AdminApiError && membersQuery.error.status === 401) {
      router.replace("/admin/login");
    }
  }, [membersQuery.error, router]);

  function openEditPanel(member: MemberListItem) {
    setSelectedMember(member);
    setPanelError("");
  }

  function resetPanel() {
    setSelectedMember(null);
    setPanelError("");
  }

  function closePanel() {
    if (isSaving || isDeleting) return;
    resetPanel();
  }

  function reloadMembers() {
    void membersQuery.refetch();
  }

  function applySelectFilters(next: Partial<Pick<MemberListFilters, "grade" | "authProvider">>) {
    setPage(1);
    setSubmittedFilters((current) => ({
      ...current,
      ...next,
    }));
  }

  function applyTextFilters() {
    setPage(1);
    setSubmittedFilters((current) => ({
      ...current,
      loginId: loginIdQuery.trim(),
      name: nameQuery.trim(),
      email: emailQuery.trim(),
    }));
  }

  function handleTextSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyTextFilters();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMember) return;

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "").trim();
    const body: {
      name: string | null;
      nickname: string | null;
      email?: string | null;
      grade: "student" | "teacher";
      password?: string;
    } = {
      name: String(formData.get("name") ?? "").trim() || null,
      nickname: String(formData.get("nickname") ?? "").trim() || null,
      grade: String(formData.get("grade") ?? "student") as "student" | "teacher",
      ...(password ? { password } : {}),
    };

    if (selectedMember.auth_provider !== "google") {
      body.email = String(formData.get("email") ?? "").trim() || null;
    }

    setPanelError("");
    try {
      await updateMember.mutateAsync({ id: selectedMember.id, body });
      resetPanel();
    } catch (error) {
      setPanelError(errorMessage(error, "저장하지 못했습니다."));
    }
  }

  async function handleDelete() {
    if (!selectedMember) return;

    setPanelError("");
    try {
      await deleteMember.mutateAsync(selectedMember.id);
      if (members.length === 1 && page > 1) setPage((current) => current - 1);
      resetPanel();
    } catch (error) {
      setPanelError(errorMessage(error, "삭제하지 못했습니다."));
    }
  }

  return (
    <>
      <AdminPageHeader description="서비스 회원 정보를 조회하고 수정합니다." title="회원" />

      <div className="mb-4 space-y-4 rounded-xl border border-[#E8E4DC] bg-white px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminFilterRow htmlFor="member-grade-filter" label="등급">
            <AdminSelect
              className="h-11"
              id="member-grade-filter"
              onChange={(event) => {
                const grade = event.target.value as MemberGradeFilter;
                setGradeFilter(grade);
                applySelectFilters({ grade });
              }}
              value={gradeFilter}
            >
              <option value="all">전체</option>
              <option value="student">학생</option>
              <option value="teacher">지도자</option>
            </AdminSelect>
          </AdminFilterRow>

          <AdminFilterRow htmlFor="member-auth-provider-filter" label="가입">
            <AdminSelect
              className="h-11"
              id="member-auth-provider-filter"
              onChange={(event) => {
                const authProvider = event.target.value as MemberAuthProviderFilter;
                setAuthProviderFilter(authProvider);
                applySelectFilters({ authProvider });
              }}
              value={authProviderFilter}
            >
              <option value="all">전체</option>
              <option value="local">일반</option>
              <option value="google">구글</option>
            </AdminSelect>
          </AdminFilterRow>
        </div>

        <AdminFilterRow htmlFor="member-login-id-filter" label="아이디 검색">
          <form className="min-w-0" onSubmit={handleTextSearchSubmit}>
            <AdminInput
              className={filterInputClassName}
              id="member-login-id-filter"
              onChange={(event) => setLoginIdQuery(event.target.value)}
              placeholder="아이디로 검색"
              type="search"
              value={loginIdQuery}
            />
          </form>
        </AdminFilterRow>

        <AdminFilterRow htmlFor="member-name-filter" label="이름 검색">
          <form className="min-w-0" onSubmit={handleTextSearchSubmit}>
            <AdminInput
              className={filterInputClassName}
              id="member-name-filter"
              onChange={(event) => setNameQuery(event.target.value)}
              placeholder="이름으로 검색"
              type="search"
              value={nameQuery}
            />
          </form>
        </AdminFilterRow>

        <AdminFilterRow htmlFor="member-email-filter" label="이메일 검색">
          <form className="min-w-0" onSubmit={handleTextSearchSubmit}>
            <AdminInput
              className={filterInputClassName}
              id="member-email-filter"
              onChange={(event) => setEmailQuery(event.target.value)}
              placeholder="이메일로 검색"
              type="search"
              value={emailQuery}
            />
          </form>
        </AdminFilterRow>
      </div>

      <AdminPagination
        disabled={isLoading}
        isRefreshing={isRefreshing}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPage(1);
          setPageSize(value);
        }}
        onRefresh={reloadMembers}
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
      />

      <MemberTable
        errorMessage={pageError}
        isLoading={isLoading}
        members={members}
        onRetry={reloadMembers}
        onRowClick={openEditPanel}
      />

      <AdminSlidePanel
        description="회원 정보를 수정하거나 삭제할 수 있습니다."
        footer={
          selectedMember ? (
            <AdminPanelFooter
              deleteConfirmMessage="이 회원을 삭제하시겠습니까? 삭제 후에는 로그인할 수 없습니다."
              isDeleting={isDeleting}
              isSaving={isSaving}
              mode="edit"
              onCancel={closePanel}
              onDelete={handleDelete}
              onSave={() => formRef.current?.requestSubmit()}
            />
          ) : null
        }
        onClose={closePanel}
        open={selectedMember !== null}
        title="회원 수정"
      >
        {selectedMember ? (
          <form
            key={selectedMember.id}
            ref={formRef}
            className="space-y-5"
            onSubmit={handleSubmit}
          >
            <MemberPanelForm member={selectedMember} />
            {panelError ? (
              <p
                aria-live="polite"
                className="rounded-lg border border-[#E6C9C5] bg-[#FDF6F5] px-4 py-3 text-sm text-[#9A3F38]"
                role="alert"
              >
                {panelError}
              </p>
            ) : null}
          </form>
        ) : null}
      </AdminSlidePanel>
    </>
  );
}

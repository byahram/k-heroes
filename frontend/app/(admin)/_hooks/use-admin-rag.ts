"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminApi, fetchAdminApiJson } from "@/app/(admin)/_lib/admin-api";

export type RagFileItem = {
  name: string;
  size: string;
  type: "PDF" | "CSV" | "PKL" | "JSON";
  uploaded_at: string;
  source: "local" | "gcs" | "both";
  status?: "completed" | "processing" | "pending" | "failed";
};

export type TaskDetail = {
  status: "idle" | "running" | "completed" | "failed";
  progress: string;
  error: string;
  target?: string;
};

export type RagFilesResponse = {
  raw: RagFileItem[];
  processed: RagFileItem[];
  tasks: {
    pdf_build: TaskDetail;
    csv_purify: TaskDetail;
    db_sync: TaskDetail;
  };
};

export const adminRagKeys = {
  all: ["admin", "rag"] as const,
  files: () => [...adminRagKeys.all, "files"] as const,
};

export function useAdminRagFiles(options?: { refetchInterval?: number }) {
  return useQuery<RagFilesResponse>({
    queryKey: adminRagKeys.files(),
    queryFn: ({ signal }) =>
      fetchAdminApiJson<RagFilesResponse>("/api/v2/admin/rag/files", { signal }),
    ...options,
  });
}

export function useUploadRagFiles() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetchAdminApi("/api/v2/admin/rag/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        let message = "파일 업로드에 실패했습니다.";
        try {
          const data = await response.json();
          if (data.detail) message = data.detail;
        } catch {}
        throw new Error(message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminRagKeys.files() });
    },
  });
}

export function useDeleteRagFile() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (fileName: string) => {
      const response = await fetchAdminApi(`/api/v2/admin/rag/files/${encodeURIComponent(fileName)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let message = "파일 삭제에 실패했습니다.";
        try {
          const data = await response.json();
          if (data.detail) message = data.detail;
        } catch {}
        throw new Error(message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminRagKeys.files() });
    },
  });
}

export function useBuildPdfVector() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (filename: string) => {
      const response = await fetchAdminApi("/api/v2/admin/rag/build-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      if (!response.ok) {
        let message = "벡터 DB 빌드 시작에 실패했습니다.";
        try {
          const data = await response.json();
          if (data.detail) message = data.detail;
        } catch {}
        throw new Error(message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminRagKeys.files() });
    },
  });
}

export function usePurifyCsv() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await fetchAdminApi("/api/v2/admin/rag/purify-csv", {
        method: "POST",
      });
      if (!response.ok) {
        let message = "CSV 정제 시작에 실패했습니다.";
        try {
          const data = await response.json();
          if (data.detail) message = data.detail;
        } catch {}
        throw new Error(message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminRagKeys.files() });
    },
  });
}

export function useSyncCharacterDb() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      const response = await fetchAdminApi("/api/v2/admin/rag/sync-db", {
        method: "POST",
      });
      if (!response.ok) {
        let message = "DB 동기화 시작에 실패했습니다.";
        try {
          const data = await response.json();
          if (data.detail) message = data.detail;
        } catch {}
        throw new Error(message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminRagKeys.files() });
    },
  });
}

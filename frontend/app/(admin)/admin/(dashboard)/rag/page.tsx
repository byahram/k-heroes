"use client";

import { useState } from "react";
import { Upload, Database, CheckCircle, Clock, FileText, Play, AlertCircle, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/app/(admin)/_components/admin-page-header";
import { AdminButton } from "@/app/(admin)/_components/admin-button";
import { AdminDataTable, AdminTableRow, AdminTableCell } from "@/app/(admin)/_components/admin-data-table";

type RagFile = {
  id: string;
  name: string;
  size: string;
  type: "PDF" | "CSV";
  uploadedAt: string;
  status: "completed" | "processing" | "pending" | "failed";
};

const INITIAL_FILES: RagFile[] = [
  {
    id: "1",
    name: "고등학교_국사_(7차_교육과정).pdf",
    size: "7.86 MB",
    type: "PDF",
    uploadedAt: "2026-06-25 14:32",
    status: "completed",
  },
  {
    id: "2",
    name: "KF_AREA_PRSN_DATA_LIST_202112.csv",
    size: "1.70 MB",
    type: "CSV",
    uploadedAt: "2026-06-25 15:10",
    status: "completed",
  },
  {
    id: "3",
    name: "KF_AREA_CLTUR_ARTS_DATA_LIST_202112.csv",
    size: "2.28 MB",
    type: "CSV",
    uploadedAt: "2026-06-25 15:11",
    status: "completed",
  },
  {
    id: "4",
    name: "대한제국_의병운동_연구자료.pdf",
    size: "3.42 MB",
    type: "PDF",
    uploadedAt: "2026-06-26 09:15",
    status: "pending",
  },
];

const COLUMNS = [
  { key: "icon", header: "", className: "w-10 text-center" },
  { key: "name", header: "파일명" },
  { key: "type", header: "형식", className: "w-24" },
  { key: "size", header: "크기", className: "w-28" },
  { key: "uploadedAt", header: "업로드 일시", className: "w-44" },
  { key: "status", header: "상태", className: "w-32" },
  { key: "actions", header: "작업", className: "w-28 text-right" },
];

export default function RagPage() {
  const [files, setFiles] = useState<RagFile[]>(INITIAL_FILES);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 파일 업로드 모의 동작 (Simulation)
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadMockFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadMockFile(e.target.files[0]);
    }
  };

  const uploadMockFile = (file: File) => {
    setIsUploading(true);
    setTimeout(() => {
      const extension = file.name.split(".").pop()?.toUpperCase() ?? "PDF";
      const newFile: RagFile = {
        id: String(Date.now()),
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        type: extension === "CSV" ? "CSV" : "PDF",
        uploadedAt: new Date().toISOString().replace("T", " ").substring(0, 16),
        status: "pending",
      };
      setFiles((prev) => [newFile, ...prev]);
      setIsUploading(false);
    }, 1500);
  };

  // 모의 임베딩 빌더 트리거
  const handleProcessEmbedding = (id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "processing" } : f))
    );

    setTimeout(() => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: "completed" } : f))
      );
    }, 4000);
  };

  // 모의 파일 삭제
  const handleDeleteFile = (id: string) => {
    if (confirm("정말 이 원본 데이터를 삭제하시겠습니까?")) {
      setFiles((prev) => prev.filter((f) => f.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="RAG 원본 자료 관리" description="역사 시뮬레이션 AI 생성을 위한 PDF 서적 및 CSV 사건 데이터를 관리합니다." />

      {/* 파일 드래그앤드롭 업로드 영역 */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 px-4 text-center transition-all ${
          dragActive
            ? "border-[#2A4232] bg-[#F4F6F4]"
            : "border-[#E8E4DC] bg-white hover:border-[#8A847C]"
        }`}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept=".pdf,.csv"
          onChange={handleFileInput}
          disabled={isUploading}
        />
        <div className="flex size-14 items-center justify-center rounded-full bg-[#F4F1EA] text-[#3A3530]">
          <Upload className={`size-6 ${isUploading ? "animate-bounce" : ""}`} />
        </div>
        
        <h3 className="mt-4 text-base font-semibold text-[#1A1714]">
          {isUploading ? "파일을 업로드하는 중..." : "PDF 도서 및 CSV 목록 업로드"}
        </h3>
        <p className="mt-1 text-xs text-[#8A847C]">
          드래그 앤 드롭하거나 아래 버튼을 통해 파일을 선택하세요. (최대 50MB)
        </p>

        <div className="mt-4">
          <label htmlFor="file-upload">
            <span className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#2A4232] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1E3024] transition-colors">
              컴퓨터에서 파일 선택
            </span>
          </label>
        </div>
      </div>

      {/* 업로드된 파일 리스트 테이블 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-[#1A1714] flex items-center gap-2">
          <Database className="size-4 text-[#8A847C]" />
          RAG 데이터 리스트
        </h3>
        
        <AdminDataTable
          columns={COLUMNS}
          emptyMessage="업로드된 RAG 데이터가 없습니다."
          isEmpty={files.length === 0}
        >
          {files.map((file) => (
            <AdminTableRow key={file.id}>
              <AdminTableCell className="text-center">
                <FileText className="size-5 text-[#8A847C] inline" />
              </AdminTableCell>
              <AdminTableCell className="font-medium text-[#1A1714]">
                {file.name}
              </AdminTableCell>
              <AdminTableCell>
                <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                  file.type === "PDF" 
                    ? "bg-red-50 text-red-700 border border-red-200" 
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}>
                  {file.type}
                </span>
              </AdminTableCell>
              <AdminTableCell className="text-[#8A847C]">
                {file.size}
              </AdminTableCell>
              <AdminTableCell className="text-[#8A847C]">
                {file.uploadedAt}
              </AdminTableCell>
              <AdminTableCell>
                {file.status === "completed" && (
                  <div className="flex items-center gap-1 text-green-700 font-medium">
                    <CheckCircle className="size-4" />
                    <span>빌드 완료</span>
                  </div>
                )}
                {file.status === "processing" && (
                  <div className="flex items-center gap-1 text-amber-700 font-medium animate-pulse">
                    <Clock className="size-4 animate-spin" />
                    <span>임베딩 중...</span>
                  </div>
                )}
                {file.status === "pending" && (
                  <div className="flex items-center gap-1 text-[#8A847C] font-medium">
                    <Clock className="size-4" />
                    <span>대기 중</span>
                  </div>
                )}
                {file.status === "failed" && (
                  <div className="flex items-center gap-1 text-red-700 font-medium">
                    <AlertCircle className="size-4" />
                    <span>실패</span>
                  </div>
                )}
              </AdminTableCell>
              <AdminTableCell className="text-right">
                <div className="flex justify-end gap-1.5">
                  {file.status === "pending" && (
                    <AdminButton
                      size="sm"
                      variant="primary"
                      className="!bg-[#2A4232] hover:!bg-[#1E3024] !py-1 flex items-center gap-1"
                      onClick={() => handleProcessEmbedding(file.id)}
                    >
                      <Play className="size-3" />
                      빌드
                    </AdminButton>
                  )}
                  {file.status === "completed" && (
                    <AdminButton
                      size="sm"
                      variant="outline"
                      className="!py-1"
                      onClick={() => handleProcessEmbedding(file.id)}
                    >
                      재빌드
                    </AdminButton>
                  )}
                  <button
                    aria-label="삭제"
                    onClick={() => handleDeleteFile(file.id)}
                    className="flex size-7 items-center justify-center rounded-md border border-[#E8E4DC] text-red-600 bg-white hover:bg-red-50 hover:border-red-200 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminDataTable>
      </div>
    </div>
  );
}

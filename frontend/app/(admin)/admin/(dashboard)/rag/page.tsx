"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  Database, 
  CheckCircle, 
  Clock, 
  FileText, 
  Play, 
  AlertCircle, 
  Trash2, 
  RefreshCw, 
  ArrowRight,
  FileCheck,
  AlertTriangle
} from "lucide-react";
import { AdminPageHeader } from "@/app/(admin)/_components/admin-page-header";
import { AdminButton } from "@/app/(admin)/_components/admin-button";
import { AdminDataTable, AdminTableRow, AdminTableCell } from "@/app/(admin)/_components/admin-data-table";
import { 
  useAdminRagFiles, 
  useUploadRagFiles, 
  useDeleteRagFile, 
  useBuildPdfVector, 
  usePurifyCsv, 
  useSyncCharacterDb 
} from "@/app/(admin)/_hooks/use-admin-rag";

const COLUMNS = [
  { key: "icon", header: "", className: "w-10 text-center" },
  { key: "name", header: "파일명", className: "min-w-[280px]" },
  { key: "type", header: "형식", className: "w-24" },
  { key: "size", header: "크기", className: "w-28" },
  { key: "source", header: "보관소", className: "w-28" },
  { key: "uploadedAt", header: "업로드 일시", className: "w-44" },
  { key: "status", header: "상태", className: "w-32" },
  { key: "actions", header: "작업", className: "w-28 text-right" },
];

const PROCESSED_COLUMNS = [
  { key: "icon", header: "", className: "w-10 text-center" },
  { key: "name", header: "산출물 명칭", className: "min-w-[280px]" },
  { key: "type", header: "포맷", className: "w-24" },
  { key: "size", header: "크기", className: "w-28" },
  { key: "source", header: "보관소", className: "w-28" },
  { key: "uploadedAt", header: "가공/업데이트 일시", className: "w-44" },
];

export default function RagPage() {
  // 5초 간격으로 백엔드 파일 정보와 백그라운드 태스크 상황을 리프레시 폴링합니다.
  const { data, isLoading, isRefetching } = useAdminRagFiles({ refetchInterval: 5000 });
  const uploadMut = useUploadRagFiles();
  const deleteMut = useDeleteRagFile();
  const buildPdfMut = useBuildPdfVector();
  const purifyCsvMut = usePurifyCsv();
  const syncDbMut = useSyncCharacterDb();

  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"raw" | "processed">("raw");

  const prevCsvPurifyStatusRef = useRef<string>("idle");
  const prevPdfBuildStatusRef = useRef<string>("idle");

  const files = data?.raw ?? [];
  const processedFiles = data?.processed ?? [];
  const tasks = data?.tasks ?? {
    pdf_build: { status: "idle", progress: "", error: "", target: "" },
    csv_purify: { status: "idle", progress: "", error: "" },
    db_sync: { status: "idle", progress: "", error: "" }
  };

  // 진행 중인 백그라운드 태스크가 있는지 여부
  const isAnyTaskRunning = 
    tasks.pdf_build.status === "running" || 
    tasks.csv_purify.status === "running" || 
    tasks.db_sync.status === "running";

  // 백그라운드 완료 감지 시 결과 탭으로 자동 이동 처리
  useEffect(() => {
    if (tasks.csv_purify.status) {
      const currentStatus = tasks.csv_purify.status;
      const prevStatus = prevCsvPurifyStatusRef.current;
      if (prevStatus === "running" && currentStatus === "completed") {
        setActiveTab("processed");
      }
      prevCsvPurifyStatusRef.current = currentStatus;
    }
  }, [tasks.csv_purify.status]);

  useEffect(() => {
    if (tasks.pdf_build.status) {
      const currentStatus = tasks.pdf_build.status;
      const prevStatus = prevPdfBuildStatusRef.current;
      if (prevStatus === "running" && currentStatus === "completed") {
        setActiveTab("processed");
      }
      prevPdfBuildStatusRef.current = currentStatus;
    }
  }, [tasks.pdf_build.status]);

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files);
    }
  };

  const handleUploadFiles = async (filesList: FileList) => {
    setUploadError(null);
    if (filesList.length > 30) {
      setUploadError("한 번에 최대 30개의 파일만 업로드할 수 있습니다.");
      return;
    }
    
    // 파일 확장자 및 용량 유효성 검증
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (extension !== "pdf" && extension !== "csv") {
        setUploadError(`지원하지 않는 파일 형식입니다: ${file.name} (PDF 또는 CSV만 지원)`);
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setUploadError(`파일 크기가 50MB를 초과합니다: ${file.name} (최대 50MB)`);
        return;
      }
    }

    try {
      for (let i = 0; i < filesList.length; i++) {
        await uploadMut.mutateAsync(filesList[i]);
      }
    } catch (err: any) {
      setUploadError(err.message || "파일 업로드에 실패했습니다. 컬럼 구성을 확인하세요.");
    }
  };

  const handleProcessEmbedding = (filename: string) => {
    if (confirm(`'${filename}' 도서 자료의 벡터 임베딩 DB 빌드를 시작하겠습니까?\n이 작업은 백그라운드에서 진행됩니다.`)) {
      buildPdfMut.mutate(filename, {
        onError: (err) => alert(err.message),
      });
    }
  };

  const handleDeleteFile = (filename: string) => {
    if (confirm(`정말 '${filename}' 원본 파일을 삭제하시겠습니까?\n보관소에서 영구 삭제됩니다.`)) {
      deleteMut.mutate(filename, {
        onError: (err) => alert(err.message),
      });
    }
  };

  const handlePurifyCsv = () => {
    if (confirm("GCS의 모든 CSV 파일들을 수집 병합하고 중복 제거를 진행하시겠습니까?")) {
      purifyCsvMut.mutate(undefined, {
        onError: (err) => alert(err.message),
      });
    }
  };

  const handleSyncDb = () => {
    if (confirm("정제된 마스터 데이터를 기반으로 GPT 프로필 카드 갱신 및 DB 동기화(시드)를 실행하시겠습니까?\nOpenAI API 호출과 DB 인서트 처리가 수행되어 수 분이 소요될 수 있습니다.")) {
      syncDbMut.mutate(undefined, {
        onError: (err) => alert(err.message),
      });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <AdminPageHeader 
        title="RAG 및 역사 데이터 관리" 
        description="역사 시뮬레이션 AI 및 RAG 검색에 활용되는 국사 교과서 PDF 도서 자료와 인물 사건 CSV 목록 데이터를 수집, 정제, 학습합니다."
      />

      {/* 실시간 백그라운드 태스크 경보/진행 바 */}
      {isAnyTaskRunning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3 shadow-sm animate-pulse">
          <h4 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <Clock className="size-4 animate-spin text-amber-600" />
            백그라운드에서 전처리 작업이 실행 중입니다. (자동 동기화 주기: 5초)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-amber-800">
            {tasks.pdf_build.status === "running" && (
              <div className="bg-white/50 p-2.5 rounded-lg border border-amber-100">
                <span className="font-semibold block mb-1">📖 PDF 벡터 DB 빌드 중</span>
                <p className="text-amber-700 font-medium">대상: {tasks.pdf_build.target}</p>
                <p className="text-gray-500 mt-1">{tasks.pdf_build.progress}</p>
              </div>
            )}
            {tasks.csv_purify.status === "running" && (
              <div className="bg-white/50 p-2.5 rounded-lg border border-amber-100">
                <span className="font-semibold block mb-1">🧹 CSV 데이터 마스터 통합 중</span>
                <p className="text-gray-500 mt-1">{tasks.csv_purify.progress}</p>
              </div>
            )}
            {tasks.db_sync.status === "running" && (
              <div className="bg-white/50 p-2.5 rounded-lg border border-amber-100">
                <span className="font-semibold block mb-1">⚡ GPT 프로필 동기화 중 (수 분 소요)</span>
                <p className="text-gray-500 mt-1">{tasks.db_sync.progress}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 파일 업로드 오류 경고창 */}
      {uploadError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2.5">
          <AlertCircle className="size-4 mt-0.5 text-red-600 shrink-0" />
          <div>
            <p className="font-semibold">업로드 오류</p>
            <p className="text-xs text-red-700 mt-0.5">{uploadError}</p>
          </div>
        </div>
      )}

      {/* 1. 파일 업로드 영역 (가로 전체 폭) */}
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
          multiple
          onChange={handleFileInput}
          disabled={uploadMut.isPending}
        />
        <div className="flex size-14 items-center justify-center rounded-full bg-[#F4F1EA] text-[#3A3530]">
          <Upload className={`size-6 ${uploadMut.isPending ? "animate-bounce text-[#2A4232]" : ""}`} />
        </div>
        
        <h3 className="mt-4 text-base font-semibold text-[#1A1714]">
          {uploadMut.isPending ? "파일을 업로드하는 중..." : "PDF 도서 및 CSV 목록 업로드"}
        </h3>
        <div className="mt-1 max-w-lg text-xs text-[#8A847C] space-y-1">
          <p>드래그 앤 드롭하거나 아래 버튼을 통해 파일을 선택하세요. (한 번에 최대 30개, 각 최대 50MB)</p>
          <p className="text-amber-700 font-medium font-sans">※ CSV 필수 스키마: DATA_MANAGE_NO, DATA_TITLE_NM, SUMRY_CN, RELATE_PRSN_NM 등이 포함되어야 합니다. 다른 컬럼구성을 업로드할 시 병합 코드가 동작하지 않습니다.</p>
        </div>

        <div className="mt-4">
          <label htmlFor="file-upload">
            <span className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-[#2A4232] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#1E3024] transition-colors">
              컴퓨터에서 파일 선택
            </span>
          </label>
        </div>
      </div>

      {/* 2. 데이터 가공 및 동기화 파이프라인 (가로 전체 폭, 단계별 직관적 레이아웃) */}
      <div className="bg-white p-6 rounded-xl border border-[#E8E4DC] space-y-4 shadow-sm">
        <h3 className="text-base font-semibold text-[#1A1714] flex items-center gap-2">
          <RefreshCw className="size-4 text-[#8A847C]" />
          데이터 가공 및 동기화 파이프라인
        </h3>
        <p className="text-xs text-[#8A847C] leading-relaxed max-w-3xl">
          업로드 완료된 원본 데이터를 결합/중복제거하여 마스터 CSV를 생성하고, GPT 엔진을 이용해 게임용 캐릭터 카드 및 역사 데이터를 DB(Supabase)에 주입합니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Step 1 */}
          <div className="p-5 rounded-xl border border-[#E8E4DC] bg-[#FDFDFC] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2A4232] bg-[#E8EDE9] px-2.5 py-0.5 rounded">1단계</span>
                <span className="text-xs text-[#8A847C] font-semibold">CSV 정제 및 마스터 통합</span>
              </div>
              <h4 className="text-sm font-semibold text-gray-900">사건/인물 CSV 마스터 통합</h4>
              <p className="text-xs text-[#8A847C] leading-relaxed">
                업로드된 모든 CSV 원본들을 GCS로부터 수집/결합하고 동일 인물/사건에 대한 중복 데이터를 제거한 후, 단일 마스터 자산인 <code className="bg-gray-100 px-1.5 py-0.5 text-red-600 rounded font-mono text-[11px]">kf_area_total_merged.csv</code> 파일로 병합 및 GCS에 저장합니다.
              </p>

              {/* 완료 상태 로그 출력 */}
              {tasks.csv_purify.status === "completed" && (
                <div className="mt-2 p-2.5 rounded-lg border border-green-200 bg-green-50 text-[11px] text-green-800 font-medium">
                  <p className="flex items-center gap-1">
                    <CheckCircle className="size-3.5 text-green-600 shrink-0" />
                    <span>최종 가공 내역 로그:</span>
                  </p>
                  <p className="mt-1 font-normal text-green-700 leading-normal">{tasks.csv_purify.progress}</p>
                </div>
              )}
            </div>
            
            <div className="pt-2">
              <AdminButton
                variant="primary"
                className="w-full !bg-[#2A4232] hover:!bg-[#1E3024] !py-2.5 text-xs flex items-center justify-center gap-1.5"
                onClick={handlePurifyCsv}
                disabled={isAnyTaskRunning || files.filter(f => f.type === "CSV").length === 0}
              >
                <FileCheck className="size-3.5" />
                데이터 정제 및 마스터 통합 시작
              </AdminButton>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-xl border border-[#E8E4DC] bg-[#FDFDFC] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded">2단계</span>
                <span className="text-xs text-[#8A847C] font-semibold">AI 프로필 생성 & DB 시딩</span>
              </div>
              <h4 className="text-sm font-semibold text-gray-900">인물 카드 갱신 및 Supabase 동기화</h4>
              <p className="text-xs text-[#8A847C] leading-relaxed">
                통합 마스터 CSV 데이터를 기반으로 OpenAI GPT 엔진을 구동해 인물 카드 프로필 데이터(성향, 스탯 등)를 자동으로 갱신하고, Supabase 데이터베이스 테이블에 최종 주입(시드)을 가동합니다.
              </p>

              {/* 완료 상태 로그 출력 */}
              {tasks.db_sync.status === "completed" && (
                <div className="mt-2 p-2.5 rounded-lg border border-green-200 bg-green-50 text-[11px] text-green-800 font-medium">
                  <p className="flex items-center gap-1">
                    <CheckCircle className="size-3.5 text-green-600 shrink-0" />
                    <span>최종 동기화 로그:</span>
                  </p>
                  <p className="mt-1 font-normal text-green-700 leading-normal">{tasks.db_sync.progress}</p>
                </div>
              )}
              
              {tasks.db_sync.status === "failed" && (
                <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 bg-red-50 p-2 rounded">
                  <AlertTriangle className="size-3 shrink-0" />
                  오류: {tasks.db_sync.error}
                </p>
              )}
            </div>

            <div className="pt-2">
              <AdminButton
                variant="primary"
                className="w-full !bg-[#2A4232] hover:!bg-[#1E3024] !py-2.5 text-xs flex items-center justify-center gap-1.5"
                onClick={handleSyncDb}
                disabled={isAnyTaskRunning || !processedFiles.some(f => f.name === "kf_area_total_merged.csv")}
              >
                <RefreshCw className="size-3.5" />
                인물 프로필 생성 및 DB 동기화 시작
              </AdminButton>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 보관 파일 인벤토리 (Tabs 스위칭 뷰 - 가로 전체 폭) */}
      <div className="bg-white rounded-xl border border-[#E8E4DC] overflow-hidden space-y-4 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1A1714] flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Database className="size-4 text-[#8A847C]" />
            보관 파일 인벤토리 목록 ({isLoading ? "조회 중..." : `${activeTab === "raw" ? files.length : processedFiles.length}개`})
          </span>
          {isRefetching && (
            <span className="text-xs text-[#8A847C] font-normal flex items-center gap-1">
              <RefreshCw className="size-3 animate-spin" /> 동기화 중...
            </span>
          )}
        </h3>

        {/* 탭 헤더 */}
        <div className="flex border-b border-[#E8E4DC] -mx-5 px-5">
          <button
            onClick={() => setActiveTab("raw")}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-[1px] ${
              activeTab === "raw"
                ? "border-[#2A4232] text-[#2A4232] border-b-[#2A4232]"
                : "border-transparent text-[#8A847C] hover:text-[#3A3530]"
            }`}
          >
            Raw 원본 파일 보관소 ({files.length}개)
          </button>
          <button
            onClick={() => setActiveTab("processed")}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-[1px] ${
              activeTab === "processed"
                ? "border-[#2A4232] text-[#2A4232] border-b-[#2A4232]"
                : "border-transparent text-[#8A847C] hover:text-[#3A3530]"
            }`}
          >
            Processed 최종 가공 산출물 ({processedFiles.length}개)
          </button>
        </div>

        {/* 탭 내용 */}
        <div className="pt-2">
          {activeTab === "raw" ? (
            <div className="space-y-2">
              <p className="text-xs text-[#8A847C] pb-2">
                GCS 버킷의 assets/raw/ 폴더에 보관된 원본 도서 PDF 및 원시 CSV 역사 데이터 파일 리스트입니다. PDF의 경우 [임베딩 빌드]를 눌러 개별 벡터 DB 가공을 처리할 수 있습니다.
              </p>
              <AdminDataTable
                columns={COLUMNS}
                emptyMessage="보관소에 보관된 원본 파일이 없습니다."
                isEmpty={files.length === 0}
                isLoading={isLoading}
              >
                {files.map((file) => (
                  <AdminTableRow key={file.name}>
                    <AdminTableCell className="text-center">
                      <FileText className="size-5 text-[#8A847C] inline" />
                    </AdminTableCell>
                    <AdminTableCell className="font-medium text-[#1A1714] break-all min-w-[280px]">
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
                    <AdminTableCell>
                      <span className="inline-flex rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-xs font-semibold">
                        GCS 원격
                      </span>
                    </AdminTableCell>
                    <AdminTableCell className="text-[#8A847C]">
                      {file.uploaded_at}
                    </AdminTableCell>
                    <AdminTableCell>
                      {file.status === "completed" && (
                        <div className="flex items-center gap-1 text-green-700 font-medium text-xs">
                          <CheckCircle className="size-3.5" />
                          <span>준비 완료</span>
                        </div>
                      )}
                      {file.status === "processing" && (
                        <div className="flex items-center gap-1 text-amber-700 font-medium text-xs">
                          <Clock className="size-3.5 animate-spin" />
                          <span>빌드 중...</span>
                        </div>
                      )}
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="flex items-center justify-end gap-2">
                        {file.type === "PDF" && (
                          <AdminButton
                            variant="secondary"
                            disabled={isAnyTaskRunning || file.status === "processing"}
                            onClick={() => handleProcessEmbedding(file.name)}
                            className="!px-2.5 !py-1 text-xs flex items-center gap-1"
                          >
                            <Play className="size-3 text-[#2A4232]" />
                            임베딩 빌드
                          </AdminButton>
                        )}
                        <button
                          aria-label="삭제"
                          disabled={isAnyTaskRunning || file.status === "processing"}
                          onClick={() => handleDeleteFile(file.name)}
                          className="flex size-7 items-center justify-center rounded-md border border-[#E8E4DC] text-red-600 bg-white hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminDataTable>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-[#8A847C] pb-2">
                GCS 버킷의 assets/processed/ 폴더에 가공 완료되어 저장된 RAG 피클(.pkl) 및 최종 통합 마스터 CSV 파일 목록입니다.
              </p>
              <AdminDataTable
                columns={PROCESSED_COLUMNS}
                emptyMessage="가공 완료된 산출물 자산이 존재하지 않습니다. 먼저 벡터 빌드 혹은 정제 통합을 가동하세요."
                isEmpty={processedFiles.length === 0}
                isLoading={isLoading}
              >
                {processedFiles.map((file) => (
                  <AdminTableRow key={file.name}>
                    <AdminTableCell className="text-center">
                      <FileCheck className="size-5 text-green-700 inline" />
                    </AdminTableCell>
                    <AdminTableCell className="font-semibold text-[#2A4232] break-all min-w-[280px]">
                      {file.name}
                    </AdminTableCell>
                    <AdminTableCell>
                      <span className="inline-flex rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-semibold">
                        {file.type}
                      </span>
                    </AdminTableCell>
                    <AdminTableCell className="text-[#8A847C]">
                      {file.size}
                    </AdminTableCell>
                    <AdminTableCell>
                      <span className="inline-flex rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 text-xs font-semibold">
                        GCS 원격
                      </span>
                    </AdminTableCell>
                    <AdminTableCell className="text-[#8A847C]">
                      {file.uploaded_at}
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminDataTable>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

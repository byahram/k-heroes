"use client";

import { useState } from "react";
import type { ClassListPageSize } from "@/components/classroom/class-list-pagination";

type UseListControlsOptions<TFilters> = {
  initialFilters: TFilters;
  initialPageSize: ClassListPageSize;
};

export function useListControls<TFilters>({
  initialFilters,
  initialPageSize,
}: UseListControlsOptions<TFilters>) {
  const [filters, setFilters] = useState<TFilters>(initialFilters);
  const [submittedFilters, setSubmittedFilters] = useState<TFilters>(initialFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<ClassListPageSize>(initialPageSize);

  function handleSearch() {
    setPage(0);
    setSubmittedFilters(filters);
  }

  function handleReset() {
    setFilters(initialFilters);
    setSubmittedFilters(initialFilters);
    setPage(0);
  }

  function handlePageSizeChange(nextPageSize: ClassListPageSize) {
    setPage(0);
    setPageSize(nextPageSize);
  }

  return {
    filters,
    handlePageSizeChange,
    handleReset,
    handleSearch,
    page,
    pageSize,
    setFilters,
    setPage,
    submittedFilters,
  };
}

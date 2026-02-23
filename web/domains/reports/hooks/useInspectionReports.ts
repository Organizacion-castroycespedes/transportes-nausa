"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchReportInspections } from "../services/reports-api";
import type { ReportInspectionsQuery, ReportInspectionsResponse } from "../types";

export const useInspectionReports = (query: ReportInspectionsQuery) => {
  const [data, setData] = useState<ReportInspectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchReportInspections(query);
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar reportes.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
};

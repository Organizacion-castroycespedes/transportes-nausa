"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReportDashboardResponse } from "../types";
import { fetchReportsDashboard } from "../services/reports-api";

export const useReportsDashboard = () => {
  const [data, setData] = useState<ReportDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchReportsDashboard();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
};

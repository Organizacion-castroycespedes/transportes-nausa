import { useCallback, useEffect, useState } from "react";
import { listDrivers } from "./api";
import type { DriverResponse } from "./types";

export const useDrivers = (headers?: HeadersInit) => {
  const [drivers, setDrivers] = useState<DriverResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDrivers(headers);
      setDrivers(result);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await listDrivers(headers);
        if (!cancelled) {
          setDrivers(result);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [headers]);

  return { drivers, loading, setDrivers, reload };
};

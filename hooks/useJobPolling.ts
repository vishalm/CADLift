import { useEffect, useState } from 'react';
import { JobRecord, jobService } from '../services/jobService';

/** Polls a job; `loaded` turns true after the first fetch, so "not found" can be told apart from "loading". */
export const useJobPollingState = (jobId: string | null, intervalMs = 500) => {
  const [job, setJob] = useState<JobRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoaded(true);
      return;
    }
    setLoaded(false);

    let cancelled = false;

    const fetchJob = async () => {
      const latest = await jobService.getJob(jobId).catch(() => null);
      if (!cancelled) {
        setJob(latest);
        setLoaded(true);
      }
    };

    fetchJob();
    const timer = setInterval(fetchJob, intervalMs);
    const unsubscribe = jobService.subscribe((changedId) => {
      if (changedId && changedId !== jobId) return;
      fetchJob();
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      unsubscribe();
    };
  }, [jobId, intervalMs]);

  return { job, loaded };
};

export const useJobPolling = (jobId: string | null, intervalMs = 500) => useJobPollingState(jobId, intervalMs).job;

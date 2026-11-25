import { useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';

export type DataAccess = { token: string; onExpired: () => void };

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function useRecords<T>(path: string, token: string, onExpired: () => void) {
  const [records, setRecords] = useState<T[]>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setRecords(undefined);
    setError('');
    void api<T[]>(path, { token }).then((data) => {
      if (active) setRecords(data);
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'Erro ao carregar os dados.');
    });
    return () => { active = false; };
  }, [path, token, onExpired, revision]);
  return { records, error, reload: () => setRevision((previous) => previous + 1) };
}

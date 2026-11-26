import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import type { DataAccess } from './WorkspaceData';
import { WorkspaceDialog } from './WorkspaceFeedback';

export const teaEndpoint = '/pacientes-tea';

export interface PacienteTea {
  id: string;
  numero_cadastro: number;
  data_cadastro: string;
  nome_completo: string;
  nivel_suporte: number;
  aguarda_diagnostico: boolean;
}

type DiagnosticoTea = Pick<PacienteTea, 'nivel_suporte'> & { outros_diagnosticos: string | null };

export function DiagnosticoTeaDialog({ patient, token, onExpired, onClose, onSaved }: DataAccess & {
  patient: PacienteTea;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [diagnosis, setDiagnosis] = useState<DiagnosticoTea>();
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const path = `${teaEndpoint}/${patient.id}`;

  useEffect(() => {
    let active = true;
    void api<DiagnosticoTea>(path, { token }).then((data) => {
      if (active) setDiagnosis(data);
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setLoadError(failure instanceof Error ? failure.message : 'Não foi possível carregar os dados do paciente.');
    });
    return () => { active = false; };
  }, [path, token, onExpired, revision]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!diagnosis || pending) return;
    const values = new FormData(event.currentTarget);
    const nivelSuporte = Number(values.get('nivelSuporte'));
    const outrosDiagnosticos = String(values.get('outrosDiagnosticos') ?? '').trim() || null;
    const body = {
      ...(nivelSuporte !== diagnosis.nivel_suporte && { nivelSuporte }),
      ...(outrosDiagnosticos !== (diagnosis.outros_diagnosticos?.trim() || null) && { outrosDiagnosticos }),
    };
    if (!Object.keys(body).length) {
      onClose();
      return;
    }

    setPending(true);
    setSaveError('');
    try {
      await api<DiagnosticoTea>(path, { token, method: 'PATCH', body });
      onSaved();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setSaveError(failure instanceof Error ? failure.message : 'Não foi possível salvar os dados do diagnóstico.');
    } finally {
      setPending(false);
    }
  }

  return <WorkspaceDialog title="Editar informações de diagnóstico" size="compact" pending={pending} onClose={onClose}>
    <form className="workspace-dialog-form" onSubmit={(event) => void save(event)}>
      <div className="workspace-dialog-content tea-diagnosis">
        <p><strong>{patient.nome_completo}</strong></p>
        {loadError ? <>
          <p className="notice error" role="alert">{loadError}</p>
          <button className="text-button" type="button" onClick={() => {
            setLoadError('');
            setRevision((current) => current + 1);
          }}>Tentar novamente</button>
        </> : !diagnosis ? <p role="status">Carregando informações de diagnóstico…</p> : <>
          <label className="field"><span>Nível de suporte</span>
            <select name="nivelSuporte" defaultValue={diagnosis.nivel_suporte} disabled={pending} required>
              <option value="1">Nível 1</option>
              <option value="2">Nível 2</option>
              <option value="3">Nível 3</option>
            </select>
          </label>
          <label className="field"><span>Outros diagnósticos (opcional)</span>
            <textarea name="outrosDiagnosticos" rows={4} defaultValue={diagnosis.outros_diagnosticos ?? ''} disabled={pending} />
          </label>
        </>}
        {saveError && <p className="notice error" role="alert">{saveError}</p>}
      </div>
      <footer className="form-actions workspace-dialog-footer">
        <button type="button" className="back-button" data-initial-focus disabled={pending} onClick={onClose}>Cancelar</button>
        <button type="submit" className="primary-button" disabled={!diagnosis || pending}>{pending ? 'Salvando…' : 'Salvar alterações'}</button>
      </footer>
    </form>
  </WorkspaceDialog>;
}

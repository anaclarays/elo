import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, areas, type Session } from './api';
import { Field, formatCpf } from './AuthPages';
import { WorkspaceDialog, type Notification } from './WorkspaceFeedback';

const periods = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
type Period = keyof typeof periods;

interface ProfileRecord {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  area_atuacao: Session['profissional']['areaAtuacao'];
  cargo: string | null;
  telefone: string | null;
  capacidade_semanal: number | null;
  periodos: Period[] | string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  status: string | null;
}

function readPeriods(value: ProfileRecord['periodos']) {
  return typeof value === 'string'
    ? value.replace(/[{}"]/g, '').split(',').map((period) => period.trim()).filter(Boolean)
    : value ?? [];
}

function periodLabel(period: string) {
  return periods[period as Period] ?? period;
}

export function ProfileModal({ session, onClose, onExpired, onUpdated, onNotify }: {
  session: Session;
  onClose: () => void;
  onExpired: () => void;
  onUpdated: (profissional: Session['profissional']) => void;
  onNotify: (notification: Notification) => void;
}) {
  const [record, setRecord] = useState<ProfileRecord | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [pending, setPending] = useState(false);

  // Campos controlados
  const [nomeCompleto, setNomeCompleto] = useState(session.profissional.nomeCompleto);
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState(session.profissional.email);
  const [cargo, setCargo] = useState(session.profissional.cargo ?? '');
  const [telefone, setTelefone] = useState('');
  const [capacidadeSemanal, setCapacidadeSemanal] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [horarioFim, setHorarioFim] = useState('');
  const [status, setStatus] = useState('');

  const isAdmin = session.profissional.areaAtuacao === 'coordenacao_administrativa';
  const initials = nomeCompleto.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'US';

  useEffect(() => {
    let active = true;
    setLoadError('');
    void api<ProfileRecord>('/profissionais/meu-perfil', { token: session.accessToken })
        .then((me) => {
            if (!active) return;
            setRecord(me);
        setNomeCompleto(me.nome_completo);
        setCpf(formatCpf(me.cpf ?? ''));
        setEmail(me.email);
        setCargo(me.cargo ?? '');
        setTelefone(me.telefone ?? '');
        setCapacidadeSemanal(me.capacidade_semanal !== null ? String(me.capacidade_semanal) : '');
        const existingPeriods = readPeriods(me.periodos);
        const firstPeriod = existingPeriods[0] ?? '';
        const preserveMultiple = existingPeriods.length > 1 || (firstPeriod !== '' && !Object.hasOwn(periods, firstPeriod));
        setPeriodo(preserveMultiple ? 'previous' : firstPeriod);
        setHorarioInicio(me.horario_inicio?.slice(0, 5) ?? '');
        setHorarioFim(me.horario_fim?.slice(0, 5) ?? '');
        setStatus(me.status ?? '');
      })
      .catch((failure: unknown) => {
        if (!active) return;
        if (failure instanceof ApiError && failure.status === 401) onExpired();
        else setLoadError(failure instanceof Error ? failure.message : 'Erro ao carregar os dados do perfil.');
      });
    return () => { active = false; };
  }, [session.accessToken, onExpired]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !record) return;

    const cleanName = nomeCompleto.trim();
    const cleanEmail = email.trim();
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanCargo = cargo.trim();

    if (!cleanName) return setSaveError('Informe o nome completo.');
    if (cleanCpf.length !== 11) return setSaveError('Informe um CPF válido com 11 dígitos.');
    if (!cleanEmail) return setSaveError('Informe o e-mail.');
    if (!isAdmin && horarioInicio && horarioFim && horarioInicio >= horarioFim) {
      return setSaveError('A hora de fim deve ser posterior à hora de início.');
    }

    const previousPeriods = readPeriods(record.periodos);
    const firstPeriod = previousPeriods[0] ?? '';
    const preserveMultiple = previousPeriods.length > 1 || (firstPeriod !== '' && !Object.hasOwn(periods, firstPeriod));
    const initialPeriodValue = preserveMultiple ? 'previous' : firstPeriod;

    const body: Record<string, unknown> = {
      ...(cleanName !== record.nome_completo && { nomeCompleto: cleanName }),
      ...(cleanCpf !== (record.cpf ?? '').replace(/\D/g, '') && { cpf: cleanCpf }),
      ...(cleanEmail !== record.email && { email: cleanEmail }),
      ...(cleanCargo !== (record.cargo ?? '') && { cargo: cleanCargo || null }),
    };

    if (!isAdmin) {
      const cleanPhone = telefone.trim();
      const parsedCapacity = capacidadeSemanal.trim() === '' ? null : Number(capacidadeSemanal);
      if (cleanPhone !== (record.telefone ?? '')) body.telefone = cleanPhone || null;
      if (parsedCapacity !== record.capacidade_semanal) body.capacidadeSemanal = parsedCapacity;
      if (periodo !== initialPeriodValue) body.periodos = periodo ? [periodo] : [];
      if (horarioInicio !== (record.horario_inicio?.slice(0, 5) ?? '')) body.horarioInicio = horarioInicio || null;
      if (horarioFim !== (record.horario_fim?.slice(0, 5) ?? '')) body.horarioFim = horarioFim || null;
      if (status !== (record.status ?? '')) body.status = status || null;
    }

    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }

    setPending(true);
    setSaveError('');
    try {
      await api('/profissionais/meu-perfil', {
        token: session.accessToken,
        method: 'PATCH',
        body,
      });

      onUpdated({
        ...session.profissional,
        nomeCompleto: cleanName,
        email: cleanEmail,
        cargo: cleanCargo || null,
      });
      onNotify({ message: 'Perfil atualizado com sucesso.', tone: 'success' });
      onClose();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setSaveError(failure instanceof Error ? failure.message : 'Não foi possível salvar as alterações.');
    } finally {
      setPending(false);
    }
  }

  const existingPeriods = record ? readPeriods(record.periodos) : [];
  const preserveMultiple = existingPeriods.length > 1 || (existingPeriods[0] && !Object.hasOwn(periods, existingPeriods[0]));

  return (
    <WorkspaceDialog title="Perfil do Usuário" onClose={onClose} pending={pending}>
      <form className="workspace-dialog-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="workspace-dialog-content">
          <div className="profile-modal-hero">
            <span className="avatar profile-modal-avatar" aria-hidden="true">{initials}</span>
          </div>

          {loadError ? (
            <p className="notice error" role="alert">{loadError}</p>
          ) : !record ? (
            <p className="team-message" role="status">Carregando informações do perfil…</p>
          ) : (
            <fieldset className="team-fields" disabled={pending}>
              <legend className="sr-only">Dados cadastrais</legend>

              <Field
                id="profile-name"
                label="Nome completo"
                value={nomeCompleto}
                onChange={(event) => setNomeCompleto(event.target.value)}
                required
                data-initial-focus
              />

              <div className="form-grid">
                <Field
                  id="profile-cpf"
                  label="CPF"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  minLength={14}
                  onChange={(event) => setCpf(formatCpf(event.target.value))}
                  required
                />
                <Field
                  id="profile-email"
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="form-grid area-row">
                <Field
                  id="profile-area"
                  label="Nível de permissão / Área"
                  value={areas[session.profissional.areaAtuacao] ?? session.profissional.areaAtuacao}
                  readOnly
                />
                <Field
                  id="profile-cargo"
                  label="Cargo (opcional)"
                  placeholder="Ex: Coordenadora Clínica"
                  value={cargo}
                  onChange={(event) => setCargo(event.target.value)}
                />
              </div>

              {!isAdmin && (
                <fieldset className="volunteer-fields">
                  <legend>Dados do voluntariado <span>(opcionais)</span></legend>
                  <div className="form-grid">
                    <Field
                      id="profile-telefone"
                      label="Telefone"
                      type="tel"
                      placeholder="(00) 00000-0000"
                      value={telefone}
                      onChange={(event) => setTelefone(event.target.value)}
                    />
                    <Field
                      id="profile-capacidade"
                      label="Capacidade semanal (sessões)"
                      type="number"
                      min="0"
                      max="2147483647"
                      step="1"
                      value={capacidadeSemanal}
                      onChange={(event) => setCapacidadeSemanal(event.target.value)}
                    />
                    <label className="field">
                      <span>Período de atendimento</span>
                      <select value={periodo} onChange={(event) => setPeriodo(event.target.value)}>
                        <option value="">Não informado</option>
                        {preserveMultiple && (
                          <option value="previous">{existingPeriods.map(periodLabel).join(' / ')}</option>
                        )}
                        {Object.entries(periods).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select value={status} onChange={(event) => setStatus(event.target.value)}>
                        <option value="">Não informado</option>
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    </label>
                    <Field
                      id="profile-inicio"
                      label="Hora de início"
                      type="time"
                      value={horarioInicio}
                      onChange={(event) => setHorarioInicio(event.target.value)}
                    />
                    <Field
                      id="profile-fim"
                      label="Hora de fim"
                      type="time"
                      value={horarioFim}
                      onChange={(event) => setHorarioFim(event.target.value)}
                    />
                  </div>
                </fieldset>
              )}
            </fieldset>
          )}

          {saveError && <p className="notice error" role="alert">{saveError}</p>}
        </div>

        <footer className="form-actions workspace-dialog-footer">
          <button type="button" className="back-button" disabled={pending} onClick={onClose}>Cancelar</button>
          <button type="submit" className="primary-button" disabled={pending || !record || Boolean(loadError)}>
            {pending ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </form>
    </WorkspaceDialog>
  );
}
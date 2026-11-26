import { CircleAlert, CircleCheck, Clock, Mail, Pencil, Phone, Trash2, UserRoundPlus, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, ApiError, areas, type Area } from './api';
import { Field, formatCpf, PasswordChecklist, PasswordField, passwordRules } from './AuthPages';
import { PageHeader, useRecords, type DataAccess } from './WorkspaceData';

const endpoint = '/profissionais';
const areaFilters = { ...areas, coordenacao_administrativa: 'Coordenação' };
const periods = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
type Period = keyof typeof periods;
const agendaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' });
const dayInMs = 86_400_000;

interface Professional {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  area_atuacao: Area;
  cargo: string | null;
  telefone: string | null;
  capacidade_semanal: number | null;
  periodos: Period[] | string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  status: string | null;
}

interface Appointment {
  profissionalId: string;
  dataInicio: string;
}

type TeamAction = { type: 'create' } | { type: 'edit' | 'remove'; person: Professional };
export type TeamNotificationAction = 'create' | 'remove';

export function TeamNotification({ action }: { action?: TeamNotificationAction }) {
  return <div className="team-notification" role="status">
    {action === 'create' && <span className="team-notification-content">
      <CircleCheck size={18} aria-hidden="true" /> Profissional cadastrado
    </span>}
    {action === 'remove' && <span className="team-notification-content team-notification-removed">
      <CircleAlert size={18} aria-hidden="true" /> Profissional removido
    </span>}
  </div>;
}

function matchText(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

function readPeriods(value: Professional['periodos']) {
  // O PostgreSQL pode devolver o array de enum como texto, por exemplo "{manha,tarde}".
  return typeof value === 'string' ? value.replace(/[{}"]/g, '').split(',').map((period) => period.trim()).filter(Boolean) : value ?? [];
}

function periodLabel(period: string) {
  return periods[period as Period] ?? period;
}

function weeklyOccupancy(appointments: Appointment[]) {
  const today = new Date(`${agendaDate.format(new Date())}T00:00:00Z`);
  const monday = today.getTime() - ((today.getUTCDay() + 6) % 7) * dayInMs;
  const nextMonday = monday + 7 * dayInMs;
  const counts = new Map<string, number>();
  for (const { profissionalId, dataInicio } of appointments) {
    const startsAt = new Date(dataInicio);
    if (Number.isNaN(startsAt.getTime())) continue;
    const day = Date.parse(`${agendaDate.format(startsAt)}T00:00:00Z`);
    if (day >= monday && day < nextMonday) {
      counts.set(profissionalId, (counts.get(profissionalId) ?? 0) + 1);
    }
  }
  return counts;
}

function availability(person: Professional) {
  const hours = [person.horario_inicio?.slice(0, 5), person.horario_fim?.slice(0, 5)]
    .filter(Boolean).join(' às ');
  return [readPeriods(person.periodos).map(periodLabel).join(' / '), hours]
    .filter(Boolean).join(', ');
}

function ProfessionalCard({ person, booked, onAction }: {
  person: Professional; booked?: number; onAction: (action: TeamAction) => void;
}) {
  const initials = person.nome_completo.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  const status = person.status || 'Ativo';
  const schedule = availability(person);
  const capacity = person.capacidade_semanal;
  const overloaded = booked !== undefined && capacity !== null && booked > capacity;
  const filled = booked !== undefined && capacity !== null && capacity > 0 ? Math.min(booked / capacity, 1) : Number(overloaded);

  return <article className="panel professional-card">
    <div className="professional-heading">
      <span className="avatar professional-avatar" aria-hidden="true">{initials}</span>
      <div className="professional-identity">
        <h2>{person.nome_completo}</h2>
        {person.cargo && <p>{person.cargo}</p>}
        <span className="professional-area">{areas[person.area_atuacao] ?? person.area_atuacao}</span>
      </div>
      <span className={matchText(status) === 'ativo' ? 'professional-status active' : 'professional-status'}>{status}</span>
    </div>
    <div className="professional-occupancy">
      <div><span>Ocupação semanal</span><strong>{booked ?? '—'}/{capacity ?? '—'}</strong></div>
      <div className="occupancy-track" aria-hidden="true">
        <span className={overloaded ? 'overloaded' : undefined} style={{ width: `${filled * 100}%` }} />
      </div>
    </div>
    <ul className="professional-contact">
      {schedule && <li><Clock size={14} aria-hidden="true" />{schedule}</li>}
      {person.telefone && <li><Phone size={14} aria-hidden="true" />{person.telefone}</li>}
      <li><Mail size={14} aria-hidden="true" />{person.email}</li>
    </ul>
    <div className="professional-actions">
      <button className="back-button" aria-label={`Editar ${person.nome_completo}`} type="button" onClick={() => onAction({ type: 'edit', person })}>
        <Pencil size={17} aria-hidden="true" /> Editar
      </button>
      <button className="icon-button professional-remove" aria-label={`Remover ${person.nome_completo}`} type="button"
        onClick={() => onAction({ type: 'remove', person })}><Trash2 size={19} aria-hidden="true" /></button>
    </div>
  </article>;
}

function TeamDialog({ title, pending, compact, onClose, children }: {
  title: string; pending: boolean; compact?: boolean; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    element.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className={`team-dialog${compact ? ' team-dialog-compact' : ''}`} aria-labelledby="team-dialog-title"
    onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <header className="team-dialog-header">
      <h2 id="team-dialog-title">{title}</h2>
      <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose} disabled={pending}><X size={20} /></button>
    </header>
    {children}
  </dialog>;
}

function TeamEditor({ action, pending, error, onClose, onValidate, onSave }: {
  action: TeamAction; pending: boolean; error: string; onClose: () => void;
  onValidate: (message: string) => void; onSave: (body: object) => void;
}) {
  const person = action.type === 'edit' ? action.person : undefined;
  const [cpf, setCpf] = useState(formatCpf(person?.cpf ?? ''));
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const previousPeriods = readPeriods(person?.periodos ?? null);
  const existingPeriod = previousPeriods[0] ?? '';
  const preservePeriods = previousPeriods.length > 1 || (existingPeriod !== '' && !Object.hasOwn(periods, existingPeriod));
  const defaultPeriod = preservePeriods ? 'previous' : existingPeriod;
  const startTime = person?.horario_inicio?.slice(0, 5) ?? '';
  const endTime = person?.horario_fim?.slice(0, 5) ?? '';
  const status = person?.status || 'Ativo';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? '').trim();
    const nomeCompleto = read('team-name');
    if (!nomeCompleto) return onValidate('Informe o nome completo.');

    const identity = { nomeCompleto, cpf: cpf.replace(/\D/g, ''), email: read('team-email') };
    const cargo = read('team-role');
    const telefone = read('team-phone');
    if ((!person || person.cargo) && !cargo) return onValidate('Informe o cargo.');
    if ((!person || person.telefone) && !telefone) return onValidate('Informe o telefone.');

    if (!person) {
      if (password !== confirmation) return onValidate('As senhas informadas precisam ser iguais.');
      onSave({ ...identity, cargo, telefone, areaAtuacao: read('areaAtuacao'), senha: password });
      return;
    }

    const horarioInicio = read('team-start');
    const horarioFim = read('team-end');
    const period = read('periodo');
    const capacity = read('team-capacity');
    onSave({
      ...(identity.nomeCompleto !== person.nome_completo && { nomeCompleto: identity.nomeCompleto }),
      ...(identity.cpf && identity.cpf !== person.cpf.replace(/\D/g, '') && { cpf: identity.cpf }),
      ...(identity.email !== person.email && { email: identity.email }),
      ...(cargo && cargo !== person.cargo && { cargo }),
      ...(telefone && telefone !== person.telefone && { telefone }),
      ...(capacity && Number(capacity) !== person.capacidade_semanal && { capacidadeSemanal: Number(capacity) }),
      ...(period !== defaultPeriod && { periodos: period ? [period] : [] }),
      ...(horarioInicio && horarioInicio !== startTime && { horarioInicio }),
      ...(horarioFim && horarioFim !== endTime && { horarioFim }),
      ...(read('status') !== status && { status: read('status') }),
    });
  }

  return <TeamDialog title={person ? 'Editar Profissional' : 'Novo Profissional'} onClose={onClose} pending={pending}>
    <form className="team-dialog-form" onSubmit={submit}>
      <div className="team-dialog-content">
        <fieldset className="team-fields" disabled={pending}>
          <legend className="sr-only">Dados do profissional</legend>
          <Field id="team-name" label="Nome completo" defaultValue={person?.nome_completo} required data-initial-focus />
          <div className="form-grid">
            <Field id="team-cpf" label="CPF" inputMode="numeric" placeholder="000.000.000-00" value={cpf}
              minLength={14} onChange={(event) => setCpf(formatCpf(event.target.value))} required={!person || Boolean(person.cpf.trim())} />
            <Field id="team-email" label="E-mail" type="email" defaultValue={person?.email} required />
            {person ? <Field id="team-area" label="Área de atuação" readOnly
              value={areas[person.area_atuacao] ?? person.area_atuacao} />
            : <label className="field"><span>Área de atuação<em aria-hidden="true"> *</em></span>
              <select name="areaAtuacao" defaultValue="" required>
                <option value="">Selecione...</option>
                {Object.entries(areas).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>}
            <Field id="team-role" label="Cargo" defaultValue={person?.cargo ?? ''} placeholder="Ex: Psicóloga Clínica"
              required={!person || Boolean(person.cargo)} />
            <Field id="team-phone" label="Telefone" type="tel" defaultValue={person?.telefone ?? ''}
              required={!person || Boolean(person.telefone)} />
            {person &&
              <Field id="team-capacity" label="Capacidade semanal (sessões)" type="number" step="1"
                defaultValue={person.capacidade_semanal ?? ''} required={person.capacidade_semanal !== null} />
            }
          </div>
          {person ? <>
            <div className="form-grid team-schedule">
              <label className="field"><span>Período</span>
                <select name="periodo" defaultValue={defaultPeriod}>
                  <option value="">Sem período</option>
                  {preservePeriods && <option value="previous">{previousPeriods.map(periodLabel).join(' / ')}</option>}
                  {Object.entries(periods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <Field id="team-start" label="Início" type="time" defaultValue={startTime} required={Boolean(startTime)} />
              <Field id="team-end" label="Fim" type="time" defaultValue={endTime} required={Boolean(endTime)} />
            </div>
            <div className="form-grid">
              <label className="field"><span>Status</span>
                <select name="status" defaultValue={status}>
                  <option>Ativo</option><option>Inativo</option>
                  {status !== 'Ativo' && status !== 'Inativo' && <option>{status}</option>}
                </select>
              </label>
            </div>
          </> : <>
            <div className="form-grid">
              <PasswordField id="team-password" label="Senha" autoComplete="new-password" value={password}
                onValue={setPassword} describedBy="password-rules" />
              <Field id="team-confirmation" label="Confirmar senha" type="password" autoComplete="new-password" required
                value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </div>
            <PasswordChecklist password={password} />
          </>}
        </fieldset>
        {error && <p className="notice error" role="alert">{error}</p>}
      </div>
      <footer className="form-actions team-dialog-footer">
        <button type="button" className="back-button" disabled={pending} onClick={onClose}>Cancelar</button>
        <button className="primary-button" disabled={pending || (!person && !passwordRules.every(([, test]) => test(password)))}>
          {pending ? (person ? 'Salvando…' : 'Cadastrando…') : (person ? 'Salvar' : 'Cadastrar')}
        </button>
      </footer>
    </form>
  </TeamDialog>;
}

export function Team({ token, onExpired, onNotify }: DataAccess & {
  onNotify: (action: TeamNotificationAction) => void;
}) {
  const query = matchText(useOutletContext<string>() ?? '');
  const [area, setArea] = useState('');
  const [action, setAction] = useState<TeamAction>();
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [edited, setEdited] = useState(false);
  const newButton = useRef<HTMLButtonElement>(null);
  const { records, error, reload } = useRecords<Professional>(endpoint, token, onExpired);
  const { records: appointments, error: agendaError, reload: reloadAgenda } =
    useRecords<Appointment>('/atendimentos?status=agendado', token, onExpired);
  const occupancy = appointments && weeklyOccupancy(appointments);
  const filtered = records?.filter((person) => (!area || person.area_atuacao === area)
    && [person.nome_completo, person.cargo, person.email].some((value) => value && matchText(value).includes(query)));

  function open(nextAction: TeamAction) {
    setEdited(false);
    setSaveError('');
    setAction(nextAction);
  }

  async function save(body?: object) {
    if (!action || pending) return;
    setPending(true);
    setSaveError('');
    try {
      if (action.type === 'create') {
        await api(endpoint, { token, body });
      } else {
        await api(`${endpoint}/${action.person.id}`, { token, body, method: action.type === 'edit' ? 'PATCH' : 'DELETE' });
      }
      setAction(undefined);
      if (action.type === 'edit') setEdited(true);
      else onNotify(action.type);
      if (action.type === 'create') setArea('');
      reload();
      requestAnimationFrame(() => newButton.current?.focus());
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setSaveError(failure instanceof Error ? failure.message : 'Não foi possível concluir a operação.');
    } finally {
      setPending(false);
    }
  }

  const count = records?.length;
  return <section className="team-page">
    <PageHeader title="Equipe" description={count === undefined ? 'Profissionais cadastrados' :
      count === 1 ? '1 profissional cadastrado' : `${count} profissionais cadastrados`}
      action={<button ref={newButton} type="button" className="primary-button" onClick={() => open({ type: 'create' })}>
        <UserRoundPlus size={18} aria-hidden="true" /> Novo Profissional
      </button>} />
    <div className="team-filters" role="group" aria-label="Filtrar por área de atuação">
      <button type="button" aria-pressed={!area} onClick={() => setArea('')}>Todos</button>
      {Object.entries(areaFilters).map(([value, label]) =>
        <button key={value} type="button" aria-pressed={area === value} onClick={() => setArea(value)}>{label}</button>)}
    </div>
    {edited && <p className="notice success team-feedback" role="status">Profissional atualizado com sucesso.</p>}
    {agendaError && !error && <p className="team-feedback" role="status">
      Ocupação semanal indisponível.{' '}
      <button type="button" className="text-button" onClick={reloadAgenda}>Tentar novamente</button>
    </p>}
    {error ? <div className="panel"><p className="notice error" role="alert">{error}</p>
      <button type="button" className="text-button" onClick={reload}>Tentar novamente</button></div>
      : !filtered ? <p className="team-message" role="status">Carregando equipe…</p>
      : !filtered.length ? <p className="team-message" role="status">Nenhum profissional encontrado.</p>
      : <div className="professional-grid">{filtered.map((person) => <ProfessionalCard key={person.id} person={person}
        booked={occupancy ? occupancy.get(person.id) ?? 0 : undefined} onAction={open} />)}</div>}
    {action?.type === 'remove' ? <TeamDialog title="Remover profissional" compact pending={pending} onClose={() => setAction(undefined)}>
      <div className="team-dialog-content team-remove-content">
        <p>Remover <strong>{action.person.nome_completo}</strong> da equipe?</p>
        <p>O cadastro será desativado. Os atendimentos e registros deste profissional serão mantidos.</p>
        {saveError && <p className="notice error" role="alert">{saveError}</p>}
      </div>
      <footer className="form-actions team-dialog-footer">
        <button type="button" className="back-button" data-initial-focus disabled={pending} onClick={() => setAction(undefined)}>Cancelar</button>
        <button type="button" className="primary-button team-danger" disabled={pending} onClick={() => void save()}>
          {pending ? 'Removendo…' : 'Remover'}
        </button>
      </footer>
    </TeamDialog> : action && <TeamEditor action={action} pending={pending} error={saveError}
      onValidate={setSaveError} onSave={(body) => void save(body)} onClose={() => setAction(undefined)} />}
  </section>;
}

import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ApiError, type Session } from './api';
import { PageHeader, useRecords, type DataAccess } from './WorkspaceData';
import { WorkspaceDialog, type Notification } from './WorkspaceFeedback';

const endpoint = '/atendimentos';
const timeZone = 'America/Recife';
const dayKey = new Intl.DateTimeFormat('sv-SE', { timeZone, dateStyle: 'short' });
const clock = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const weekRange = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' });
const longDay = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDay = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });

// Os mesmos tipos aceitos pelo backend em POST /atendimentos
const appointmentTypes = {
  psicologia: 'Psicologia',
  'terapia ocupacional': 'Terapia ocupacional',
  pedagogia: 'Pedagogia',
};
type AppointmentType = keyof typeof appointmentTypes;

interface Appointment {
  id: string;
  pacienteId: string;
  isTea: boolean;
  profissionalId: string;
  dataInicio: string;
  dataFim: string;
  tipo: AppointmentType;
  status: 'agendado' | 'cancelado';
  motivoCancelamento: string | null;
}

interface Beneficiary { id: number; nomeBeneficiario: string; numeroCadastro: string | number | null }
interface TeaPatient { id: string; nome_completo: string; numero_cadastro: string | number | null }

interface Professional {
  id: string;
  nome_completo: string;
  horario_inicio: string | null;
  horario_fim: string | null;
  status: string | null;
}

interface Patient { key: string; id: string; isTea: boolean; nome: string; numeroCadastro: string | number | null }

type AgendaAction =
  | { type: 'create'; day?: string }
  | { type: 'details'; appointment: Appointment }
  | { type: 'edit'; appointment: Appointment }
  | { type: 'cancel'; appointment: Appointment };

const patientKey = (isTea: boolean, id: string | number) => `${isTea ? 'tea' : 'beneficiario'}:${id}`;

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(day: string) {
  return addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
}

const utcDay = (day: string) => new Date(`${day}T12:00:00Z`);
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
const today = () => dayKey.format(new Date());
const startsAt = (appointment: Appointment) => new Date(appointment.dataInicio);
const timeRange = (appointment: Appointment) => `${clock.format(startsAt(appointment))} – ${clock.format(new Date(appointment.dataFim))}`;

// Profissional marcado como "Inativo" na tela de Equipe não recebe novos atendimentos
const isActiveProfessional = (professional: Professional) => professional.status?.trim().toLowerCase() !== 'inativo';

function workingHours(professional: Professional) {
  if (!professional.horario_inicio || !professional.horario_fim) return 'sem horário cadastrado';
  return `${professional.horario_inicio.slice(0, 5)}–${professional.horario_fim.slice(0, 5)}`;
}

function AppointmentEditor({ action, patients, professionals, person, admin, defaultProfessional, pending, error, onClose, onSave }: {
  action: Extract<AgendaAction, { type: 'create' | 'edit' }>; patients?: Patient[]; professionals?: Professional[];
  person: Session['profissional']; admin: boolean; defaultProfessional: string; pending: boolean; error: string;
  onClose: () => void; onSave: (body: object, day: string) => void;
}) {
  const current = action.type === 'edit' ? action.appointment : undefined;
  const initial = {
    patient: current ? patientKey(current.isTea, current.pacienteId) : '',
    professional: current?.profissionalId ?? (admin ? defaultProfessional : person.id),
    type: current?.tipo ?? '',
    date: current ? dayKey.format(startsAt(current)) : action.type === 'create' ? action.day ?? '' : '',
    time: current ? clock.format(startsAt(current)) : '',
  };
  const [patient, setPatient] = useState(initial.patient);
  const [professional, setProfessional] = useState(initial.professional);
  const [type, setType] = useState(initial.type);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);

  const selectedProfessional = professionals?.find(({ id }) => id === professional);
  const selectedPatient = patients?.find(({ key }) => key === patient);
  const changed = patient !== initial.patient || professional !== initial.professional || type !== initial.type
    || date !== initial.date || time !== initial.time;
  const complete = Boolean(patient && professional && type && date && time);
  // O backend só aceita o id do paciente na forma certa: UUID para TEA e número para os demais
  const patientBody = selectedPatient && { pacienteId: selectedPatient.isTea ? selectedPatient.id : Number(selectedPatient.id), isTea: selectedPatient.isTea };
  const professionalOptions = professionals?.filter((option) => isActiveProfessional(option) || option.id === initial.professional);
  const groups = [['Aprendizagem', false], ['TEA', true]] as const;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || !patientBody) return;
    // Horário de Recife (UTC-3, sem horário de verão)
    const dataInicio = `${date}T${time}:00-03:00`;
    if (!current) {
      onSave({ ...patientBody, profissionalId: professional, tipo: type, dataInicio }, date);
      return;
    }
    // Na alteração, só vão para o backend os campos que mudaram
    onSave({
      ...(patient !== initial.patient && patientBody),
      ...(professional !== initial.professional && { profissionalId: professional }),
      ...(type !== initial.type && { tipo: type }),
      ...((date !== initial.date || time !== initial.time) && { dataInicio }),
    }, date);
  }

  return <WorkspaceDialog title={current ? 'Alterar Atendimento' : 'Novo Atendimento'} pending={pending} onClose={onClose}>
    <form className="workspace-dialog-form" onSubmit={submit}>
      <div className="workspace-dialog-content">
        <fieldset className="agenda-fields" disabled={pending}>
          <legend className="sr-only">Dados do atendimento</legend>
          <label className="field"><span>Paciente</span>
            <select required value={patient} onChange={(event) => setPatient(event.target.value)} data-initial-focus>
              <option value="">{patients ? 'Selecione o paciente' : 'Carregando pacientes…'}</option>
              {groups.map(([label, isTea]) => <optgroup key={label} label={label}>
                {patients?.filter((option) => option.isTea === isTea).map((option) => <option key={option.key} value={option.key}>
                  {option.nome}{option.numeroCadastro ? ` (Nº ${option.numeroCadastro})` : ''}
                </option>)}
              </optgroup>)}
              {current && !selectedPatient && <option value={initial.patient}>Paciente inativo</option>}
            </select>
          </label>
          {admin ? <label className="field"><span>Profissional responsável</span>
            <select required value={professional} onChange={(event) => setProfessional(event.target.value)}>
              <option value="">{professionals ? 'Selecione o profissional' : 'Carregando profissionais…'}</option>
              {professionalOptions?.map((option) => <option key={option.id} value={option.id}>
                {option.nome_completo} ({workingHours(option)})
              </option>)}
            </select>
          </label> : <label className="field"><span>Profissional responsável</span>
            <input readOnly value={person.nomeCompleto} />
          </label>}
          <label className="field"><span>Tipo de atendimento</span>
            <select required value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Selecione o tipo</option>
              {Object.entries(appointmentTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="form-grid">
            <label className="field"><span>Data</span>
              <input type="date" required min={today()} value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="field"><span>Horário de início</span>
              <input type="time" required value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
          </div>
          <p className="agenda-hint">
            Cada atendimento dura 20 minutos e precisa caber no horário do profissional
            {selectedProfessional ? ` (${workingHours(selectedProfessional)})` : ''}.
            {!current && ' Se o paciente estiver na lista de espera, ele sai da fila ao confirmar.'}
          </p>
        </fieldset>
        {error && <p className="notice error" role="alert">{error}</p>}
      </div>
      <footer className="form-actions workspace-dialog-footer">
        <button type="button" className="back-button" disabled={pending} onClick={onClose}>Cancelar</button>
        <button className="primary-button" disabled={pending || !complete || !changed}>
          {pending ? 'Salvando…' : current ? 'Salvar alterações' : 'Agendar'}
        </button>
      </footer>
    </form>
  </WorkspaceDialog>;
}

export function Agenda({ token, onExpired, onNotify, person }: DataAccess & {
  onNotify: (notification: Notification) => void; person: Session['profissional'];
}) {
  const admin = person.areaAtuacao === 'coordenacao_administrativa';
  const [week, setWeek] = useState(() => startOfWeek(today()));
  const [professionalFilter, setProfessionalFilter] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [action, setAction] = useState<AgendaAction>();
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [reason, setReason] = useState('');

  const { records: appointments, error, reload } = useRecords<Appointment>(endpoint, token, onExpired);
  const beneficiaries = useRecords<Beneficiary>('/pacientes', token, onExpired);
  const teaPatients = useRecords<TeaPatient>('/pacientes-tea', token, onExpired);
  // Só a coordenação pode listar a equipe; o voluntário vê e gerencia apenas a própria agenda
  const team = useRecords<Professional>(admin ? '/profissionais' : null, token, onExpired);

  const patients: Patient[] | undefined = beneficiaries.records && teaPatients.records && [
    ...beneficiaries.records.map((record) => ({ key: patientKey(false, record.id), id: String(record.id), isTea: false, nome: record.nomeBeneficiario, numeroCadastro: record.numeroCadastro })),
    ...teaPatients.records.map((record) => ({ key: patientKey(true, record.id), id: record.id, isTea: true, nome: record.nome_completo, numeroCadastro: record.numero_cadastro })),
  ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const patientsByKey = new Map(patients?.map((patient) => [patient.key, patient]));
  const professionalsById = new Map(team.records?.map((professional) => [professional.id, professional]));
  const namesError = beneficiaries.error || teaPatients.error || team.error;

  const patientName = (appointment: Appointment) => patientsByKey.get(patientKey(appointment.isTea, appointment.pacienteId))?.nome
    ?? (patients ? 'Paciente inativo' : 'Carregando…');
  const professionalName = (id: string) => id === person.id ? person.nomeCompleto
    : professionalsById.get(id)?.nome_completo ?? (team.records ? 'Profissional removido' : 'Carregando…');
  const canManage = (appointment: Appointment) => appointment.status === 'agendado' && startsAt(appointment) > new Date()
    && (admin || appointment.profissionalId === person.id);

  const lastDay = addDays(week, 6);
  const currentDay = today();
  const mine = appointments?.filter((appointment) => admin
    ? !professionalFilter || appointment.profissionalId === professionalFilter
    : appointment.profissionalId === person.id);
  const ofWeek = mine?.filter((appointment) => {
    const day = dayKey.format(startsAt(appointment));
    return day >= week && day <= lastDay;
  }).sort((a, b) => startsAt(a).getTime() - startsAt(b).getTime());
  const visible = ofWeek?.filter((appointment) => showCancelled || appointment.status === 'agendado');
  const byDay = new Map<string, Appointment[]>();
  for (const appointment of visible ?? []) {
    const day = dayKey.format(startsAt(appointment));
    byDay.set(day, [...byDay.get(day) ?? [], appointment]);
  }
  // Domingo só aparece quando há atendimento marcado nele
  const days = Array.from({ length: byDay.has(lastDay) ? 7 : 6 }, (_, index) => addDays(week, index));
  const scheduled = ofWeek?.filter((appointment) => appointment.status === 'agendado').length;
  const cancelled = ofWeek ? ofWeek.length - (scheduled ?? 0) : 0;

  function open(nextAction: AgendaAction) {
    setSaveError('');
    setReason('');
    setAction(nextAction);
  }

  async function run(request: () => Promise<unknown>, notification: Notification, day?: string) {
    setPending(true);
    setSaveError('');
    try {
      await request();
      setAction(undefined);
      onNotify(notification);
      if (day) setWeek(startOfWeek(day));
      reload();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setSaveError(failure instanceof Error ? failure.message : 'Não foi possível concluir a operação.');
    } finally {
      setPending(false);
    }
  }

  function save(body: object, day: string) {
    if (!action || action.type === 'details' || action.type === 'cancel') return;
    void run(action.type === 'create'
      ? () => api(endpoint, { token, body })
      : () => api(`${endpoint}/${action.appointment.id}`, { token, body, method: 'PATCH' }),
    { message: action.type === 'create' ? 'Atendimento agendado' : 'Atendimento alterado', tone: 'success' }, day);
  }

  function cancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action?.type !== 'cancel') return;
    const motivo = reason.trim();
    void run(() => api(`${endpoint}/${action.appointment.id}/cancelar`, { token, method: 'PATCH', body: motivo ? { motivo } : {} }),
      { message: 'Atendimento cancelado', tone: 'danger' });
  }

  const summary = !ofWeek ? 'Atendimentos da semana'
    : `${scheduled} ${scheduled === 1 ? 'atendimento agendado' : 'atendimentos agendados'} nesta semana`
      + (cancelled ? ` · ${cancelled} ${cancelled === 1 ? 'cancelado' : 'cancelados'}` : '');

  return <section className="agenda-page">
    <PageHeader title="Agenda Inteligente" description={summary}
      action={<button type="button" className="primary-button" onClick={() => open({ type: 'create' })}>
        <CalendarPlus size={18} aria-hidden="true" /> Novo Atendimento
      </button>} />
    <div className="agenda-toolbar">
      <div className="agenda-week" role="group" aria-label="Semana exibida">
        <button type="button" className="icon-button" aria-label="Semana anterior" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft size={20} /></button>
        <button type="button" className="agenda-today" disabled={week === startOfWeek(currentDay)} onClick={() => setWeek(startOfWeek(currentDay))}>Hoje</button>
        <button type="button" className="icon-button" aria-label="Próxima semana" onClick={() => setWeek(addDays(week, 7))}><ChevronRight size={20} /></button>
        <h2 aria-live="polite">{weekRange.formatRange(utcDay(week), utcDay(addDays(week, 5)))}</h2>
      </div>
      <div className="agenda-filters">
        {admin && <label className="field agenda-professional"><span className="sr-only">Profissional</span>
          <select value={professionalFilter} onChange={(event) => setProfessionalFilter(event.target.value)}>
            <option value="">Todos os profissionais</option>
            {team.records?.map((professional) => <option key={professional.id} value={professional.id}>{professional.nome_completo}</option>)}
          </select>
        </label>}
        <button type="button" className="agenda-toggle" aria-pressed={showCancelled} onClick={() => setShowCancelled(!showCancelled)}>
          Mostrar cancelados
        </button>
      </div>
    </div>
    {namesError && !error && <p className="agenda-feedback" role="status">
      Não foi possível carregar todos os nomes.{' '}
      <button type="button" className="text-button" onClick={() => { beneficiaries.reload(); teaPatients.reload(); team.reload(); }}>Tentar novamente</button>
    </p>}
    {error ? <div className="panel"><p className="notice error" role="alert">{error}</p>
      <button type="button" className="text-button" onClick={reload}>Tentar novamente</button></div>
      : !appointments ? <p className="agenda-message" role="status">Carregando agenda…</p>
      : <div className="agenda-grid">{days.map((day) => {
        const items = byDay.get(day) ?? [];
        const past = day < currentDay;
        return <section key={day} className={`agenda-day${day === currentDay ? ' today' : ''}${past ? ' past' : ''}`} aria-label={longDay.format(utcDay(day))}>
          <header className="agenda-day-header">
            <span><strong>{weekday.format(utcDay(day)).replace('.', '')}</strong><small>{shortDay.format(utcDay(day))}</small></span>
            {!past && <button type="button" className="icon-button" aria-label={`Agendar em ${longDay.format(utcDay(day))}`}
              title="Agendar neste dia" onClick={() => open({ type: 'create', day })}><Plus size={17} /></button>}
          </header>
          {items.length ? <ul>{items.map((appointment) => <li key={appointment.id}>
            <button type="button" className={`agenda-card type-${appointment.tipo.replace(' ', '-')}${appointment.status === 'cancelado' ? ' cancelled' : ''}`}
              onClick={() => open({ type: 'details', appointment })}>
              <span className="agenda-time">{timeRange(appointment)}</span>
              <strong>{patientName(appointment)}</strong>
              <small>{appointmentTypes[appointment.tipo]}{admin && !professionalFilter ? ` · ${professionalName(appointment.profissionalId)}` : ''}</small>
              {appointment.status === 'cancelado' && <span className="agenda-badge">Cancelado</span>}
            </button>
          </li>)}</ul> : <p className="agenda-empty">Sem atendimentos</p>}
        </section>;
      })}</div>}

    {action?.type === 'details' && <WorkspaceDialog title="Atendimento" size="compact" onClose={() => setAction(undefined)}>
      <div className="workspace-dialog-content">
        <dl className="agenda-details">
          <div><dt>Paciente</dt><dd>{patientName(action.appointment)}<small>{action.appointment.isTea ? 'TEA' : 'Aprendizagem'}</small></dd></div>
          <div><dt>Profissional</dt><dd>{professionalName(action.appointment.profissionalId)}</dd></div>
          <div><dt>Tipo</dt><dd>{appointmentTypes[action.appointment.tipo]}</dd></div>
          <div><dt>Data</dt><dd>{capitalize(longDay.format(utcDay(dayKey.format(startsAt(action.appointment)))))}</dd></div>
          <div><dt>Horário</dt><dd>{timeRange(action.appointment)}</dd></div>
          <div><dt>Situação</dt><dd>{action.appointment.status === 'cancelado' ? 'Cancelado' : 'Agendado'}</dd></div>
          {action.appointment.motivoCancelamento && <div><dt>Motivo do cancelamento</dt><dd>{action.appointment.motivoCancelamento}</dd></div>}
        </dl>
      </div>
      <footer className="form-actions workspace-dialog-footer">
        {canManage(action.appointment) ? <>
          <button type="button" className="back-button agenda-cancel" onClick={() => open({ type: 'cancel', appointment: action.appointment })}>Cancelar atendimento</button>
          <button type="button" className="primary-button" data-initial-focus onClick={() => open({ type: 'edit', appointment: action.appointment })}>Alterar</button>
        </> : <button type="button" className="back-button" data-initial-focus onClick={() => setAction(undefined)}>Fechar</button>}
      </footer>
    </WorkspaceDialog>}

    {action?.type === 'cancel' && <WorkspaceDialog title="Cancelar atendimento" size="compact" pending={pending} onClose={() => setAction(undefined)}>
      <form className="workspace-dialog-form" onSubmit={cancel}>
        <div className="workspace-dialog-content workspace-remove-content">
          <p>Cancelar o atendimento de <strong>{patientName(action.appointment)}</strong> em {shortDay.format(utcDay(dayKey.format(startsAt(action.appointment))))} às {clock.format(startsAt(action.appointment))}?</p>
          <p>O atendimento continua no histórico, marcado como cancelado.</p>
          <label className="field"><span>Motivo (opcional)</span>
            <textarea className="agenda-reason" maxLength={500} value={reason} disabled={pending} data-initial-focus onChange={(event) => setReason(event.target.value)} />
          </label>
          {saveError && <p className="notice error" role="alert">{saveError}</p>}
        </div>
        <footer className="form-actions workspace-dialog-footer">
          <button type="button" className="back-button" disabled={pending} onClick={() => setAction(undefined)}>Voltar</button>
          <button className="primary-button workspace-danger" disabled={pending}>{pending ? 'Cancelando…' : 'Cancelar atendimento'}</button>
        </footer>
      </form>
    </WorkspaceDialog>}

    {(action?.type === 'create' || action?.type === 'edit') && <AppointmentEditor action={action} patients={patients}
      professionals={team.records} person={person} admin={admin} defaultProfessional={professionalFilter}
      pending={pending} error={saveError} onClose={() => setAction(undefined)} onSave={save} />}
  </section>;
}

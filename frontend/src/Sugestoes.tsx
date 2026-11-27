import { CalendarMinus, Check, History, Pencil, RefreshCw, TrendingUp, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import { PageHeader, useRecords, type DataAccess } from './WorkspaceData';
import { WorkspaceDialog, type Notification } from './WorkspaceFeedback';

const endpoint = '/sugestoes';
const dateTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'short' });
const clock = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife', dateStyle: 'short' });
const longDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', weekday: 'long', day: '2-digit', month: '2-digit' });

// Os mesmos tipos aceitos pelo backend em POST /atendimentos
const appointmentTypes = { psicologia: 'Psicologia', 'terapia ocupacional': 'Terapia ocupacional', pedagogia: 'Pedagogia' };
type AppointmentType = keyof typeof appointmentTypes;

type SuggestionType = 'sobrecarga' | 'vaga_fila' | 'reducao_frequencia';

// Mesmos tipos de GET /sugestoes, com rótulo e ícone para a tela
const types = {
  sobrecarga: { label: 'Sobrecarga', Icon: TrendingUp },
  vaga_fila: { label: 'Vaga para a fila', Icon: UserPlus },
  reducao_frequencia: { label: 'Redução de frequência', Icon: CalendarMinus },
} satisfies Record<SuggestionType, { label: string; Icon: typeof TrendingUp }>;

interface Suggestion {
  id: string;
  tipo: SuggestionType;
  titulo: string;
  motivo: string;
  consequencia: string;
  // false quando a sugestão muda a agenda de outro profissional e só a coordenação decide
  podeDecidir: boolean;
  acao: SuggestionAction;
}

// O que a aprovação faz na agenda; usado para preencher o formulário de Modificar
type SuggestionAction =
  | { tipo: 'transferir'; profissionalId: string; profissionalNome: string; dataInicio: string }
  | { tipo: 'agendar'; profissionalId: string; profissionalNome: string; dataInicio: string; tipoAtendimento: AppointmentType }
  | { tipo: 'cancelar'; atendimentos: { id: string; dataInicio: string }[] };

interface Professional { id: string; nome_completo: string; status: string | null; horario_inicio: string | null; horario_fim: string | null }

interface SuggestionList { geradasEm: string; sugestoes: Suggestion[] }

interface Decision {
  id: string;
  tipo: SuggestionType;
  titulo: string;
  decisao: 'aprovada' | 'descartada' | 'modificada';
  motivo: string | null;
  ajuste: string | null;
  decididoEm: string;
  decididoPorNome: string;
}

type View = 'pending' | 'history';
type Action = { type: 'approve' | 'discard' | 'modify'; suggestion: Suggestion };
const decisionLabels = { aprovada: 'Aprovada', descartada: 'Descartada', modificada: 'Modificada' };

export function Sugestoes({ token, onExpired, onNotify, admin }: DataAccess & { onNotify: (notification: Notification) => void; admin: boolean }) {
  const [data, setData] = useState<SuggestionList>();
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('pending');
  const [action, setAction] = useState<Action>();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const history = useRecords<Decision>(view === 'history' ? `${endpoint}/historico` : null, token, onExpired);
  // Só a coordenação consulta a equipe (e só ela pode trocar o profissional)
  const team = useRecords<Professional>(admin && action?.type === 'modify' ? '/profissionais' : null, token, onExpired);

  const load = useCallback(() => {
    let active = true;
    setError('');
    void api<SuggestionList>(endpoint, { token }).then((result) => {
      if (active) setData(result);
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'Erro ao carregar as sugestões.');
    });
    return () => { active = false; };
  }, [token, onExpired]);

  useEffect(load, [load]);

  function open(type: Action['type'], suggestion: Suggestion) {
    setReason('');
    setSaveError('');
    setAction({ type, suggestion });
  }

  function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || action.type === 'modify') return;
    const motivo = reason.trim();
    if (action.type === 'discard' && !motivo) return;
    void send(action.type === 'approve' ? 'aprovar' : 'descartar', action.type === 'discard' ? { motivo } : {},
      action.type === 'approve' ? 'Sugestão aprovada e aplicada na agenda' : 'Sugestão descartada');
  }

  async function send(route: 'aprovar' | 'descartar' | 'modificar', body: object, message: string) {
    if (!action) return;
    setPending(true);
    setSaveError('');
    try {
      await api(`${endpoint}/${action.suggestion.id}/${route}`, { token, method: 'POST', body });
      setAction(undefined);
      onNotify({ message, tone: 'success' });
      load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else {
        setSaveError(failure instanceof Error ? failure.message : 'Não foi possível concluir a operação.');
        // A sugestão pode ter deixado de existir (ex.: alguém mudou a agenda); a lista é recalculada
        if (failure instanceof ApiError && (failure.status === 404 || failure.status === 409)) load();
      }
    } finally {
      setPending(false);
    }
  }

  const count = data?.sugestoes.length;
  const description = count === undefined ? 'Recomendações calculadas a partir da agenda e da lista de espera'
    : `${count === 0 ? 'Nenhuma sugestão pendente' : `${count} ${count === 1 ? 'sugestão pendente' : 'sugestões pendentes'}`}`
      + ` · atualizado às ${clock.format(new Date(data!.geradasEm))}`;

  return <section className="suggestions-page">
    <PageHeader title="Sugestões de IA" description={description}
      action={<button type="button" className="back-button suggestions-refresh" onClick={() => { load(); history.reload(); }}>
        <RefreshCw size={17} aria-hidden="true" /> Atualizar
      </button>} />

    <div className="suggestions-tabs" role="group" aria-label="Exibir">
      <button type="button" className="agenda-toggle" aria-pressed={view === 'pending'} onClick={() => setView('pending')}>
        Pendentes{count ? ` (${count})` : ''}
      </button>
      <button type="button" className="agenda-toggle" aria-pressed={view === 'history'} onClick={() => setView('history')}>
        <History size={16} aria-hidden="true" /> Histórico de decisões
      </button>
    </div>

    {view === 'pending' && (error ? <div className="panel"><p className="notice error" role="alert">{error}</p>
      <button type="button" className="text-button" onClick={load}>Tentar novamente</button></div>
      : !data ? <p className="agenda-message" role="status">Calculando sugestões…</p>
      : !data.sugestoes.length ? <div className="panel suggestions-empty">
        <Check size={22} aria-hidden="true" />
        <div><h2>Nenhuma sugestão no momento</h2>
          <p>{admin ? 'Ninguém está acima da capacidade semanal, e não há vaga livre para a lista de espera nas próximas duas semanas.'
            : 'Nenhuma sugestão envolve a sua agenda agora.'}</p></div>
      </div>
      : <ul className="suggestions-list">{data.sugestoes.map((suggestion) => {
        const { label, Icon } = types[suggestion.tipo];
        return <li key={suggestion.id} className={`suggestion-card tone-${suggestion.tipo}`}>
          <span className="suggestion-type"><Icon size={16} aria-hidden="true" /> {label}</span>
          <h2>{suggestion.titulo}</h2>
          <dl>
            <div><dt>Por quê</dt><dd>{suggestion.motivo}</dd></div>
            <div><dt>O que acontece ao aprovar</dt><dd>{suggestion.consequencia}</dd></div>
          </dl>
          {suggestion.podeDecidir ? <div className="suggestion-actions">
            <button type="button" className="back-button" onClick={() => open('discard', suggestion)}><X size={17} aria-hidden="true" /> Descartar</button>
            {/* Redução com um só atendimento não tem o que ajustar: é aprovar ou descartar */}
            {(suggestion.acao.tipo !== 'cancelar' || suggestion.acao.atendimentos.length > 1) &&
              <button type="button" className="back-button" onClick={() => open('modify', suggestion)}><Pencil size={16} aria-hidden="true" /> Modificar</button>}
            <button type="button" className="primary-button" onClick={() => open('approve', suggestion)}><Check size={17} aria-hidden="true" /> Aprovar</button>
          </div> : <p className="suggestion-locked">Muda a agenda de outro profissional: só a coordenação pode decidir.</p>}
        </li>;
      })}</ul>)}

    {view === 'history' && (history.error ? <div className="panel"><p className="notice error" role="alert">{history.error}</p>
      <button type="button" className="text-button" onClick={history.reload}>Tentar novamente</button></div>
      : !history.records ? <p className="agenda-message" role="status">Carregando histórico…</p>
      : !history.records.length ? <p className="agenda-message">Nenhuma sugestão foi decidida ainda.</p>
      : <ul className="decision-list">{history.records.map((decision) => <li key={decision.id}>
        <span className={`decision-badge ${decision.decisao}`}>{decisionLabels[decision.decisao]}</span>
        <div>
          <strong>{decision.titulo}</strong>
          <small>{types[decision.tipo]?.label ?? decision.tipo} · {decision.decididoPorNome} · {dateTime.format(new Date(decision.decididoEm))}</small>
          {decision.ajuste && <p>Ajuste: {decision.ajuste}</p>}
          {decision.motivo && <p>Motivo: {decision.motivo}</p>}
        </div>
      </li>)}</ul>)}

    {action?.type === 'modify' && <ModifyDialog suggestion={action.suggestion} admin={admin} team={team.records}
      pending={pending} error={saveError} onClose={() => setAction(undefined)}
      onSubmit={(body) => void send('modificar', body, 'Sugestão aprovada com ajustes e aplicada na agenda')} />}

    {action && action.type !== 'modify' && <WorkspaceDialog title={action.type === 'approve' ? 'Aprovar sugestão' : 'Descartar sugestão'} size="compact"
      pending={pending} onClose={() => setAction(undefined)}>
      <form className="workspace-dialog-form" onSubmit={decide}>
        <div className="workspace-dialog-content workspace-remove-content">
          <p><strong>{action.suggestion.titulo}</strong></p>
          {action.type === 'approve' ? <>
            <p>{action.suggestion.consequencia}</p>
            <p>A alteração é feita na agenda agora, com as mesmas validações de um agendamento manual.</p>
          </> : <label className="field"><span>Motivo do descarte</span>
            <textarea className="agenda-reason" maxLength={500} required value={reason} disabled={pending} data-initial-focus
              placeholder="Ex.: a família pediu outro horário" onChange={(event) => setReason(event.target.value)} />
          </label>}
          {saveError && <p className="notice error" role="alert">{saveError}</p>}
        </div>
        <footer className="form-actions workspace-dialog-footer">
          <button type="button" className="back-button" disabled={pending} onClick={() => setAction(undefined)}>Voltar</button>
          {action.type === 'approve'
            ? <button className="primary-button" disabled={pending} data-initial-focus>{pending ? 'Aprovando…' : 'Aprovar'}</button>
            : <button className="primary-button workspace-danger" disabled={pending || !reason.trim()}>{pending ? 'Descartando…' : 'Descartar'}</button>}
        </footer>
      </form>
    </WorkspaceDialog>}
  </section>;
}

const toDate = (iso: string) => dayKey.format(new Date(iso));
const toTime = (iso: string) => clock.format(new Date(iso));
const isActive = (professional: Professional) => professional.status?.trim().toLowerCase() !== 'inativo';

// Formulário de "Modificar": os campos mudam conforme o que a sugestão faz na agenda
function ModifyDialog({ suggestion, admin, team, pending, error, onClose, onSubmit }: {
  suggestion: Suggestion; admin: boolean; team?: Professional[]; pending: boolean; error: string;
  onClose: () => void; onSubmit: (body: object) => void;
}) {
  const acao = suggestion.acao;
  const scheduled = acao.tipo === 'cancelar' ? undefined : acao;
  const [professional, setProfessional] = useState(scheduled?.profissionalId ?? '');
  const [date, setDate] = useState(scheduled ? toDate(scheduled.dataInicio) : '');
  const [time, setTime] = useState(scheduled ? toTime(scheduled.dataInicio) : '');
  const [type, setType] = useState<AppointmentType | ''>(acao.tipo === 'agendar' ? acao.tipoAtendimento : '');
  const [kept, setKept] = useState<string[]>(acao.tipo === 'cancelar' ? acao.atendimentos.map((a) => a.id) : []);
  const [reason, setReason] = useState('');

  // Só os campos que mudaram vão para o backend
  const body: Record<string, unknown> = {};
  if (scheduled) {
    if (professional !== scheduled.profissionalId) body.profissionalId = professional;
    if (date !== toDate(scheduled.dataInicio) || time !== toTime(scheduled.dataInicio)) body.dataInicio = `${date}T${time}:00-03:00`;
    if (acao.tipo === 'agendar' && type !== acao.tipoAtendimento) body.tipo = type;
  } else if (acao.tipo === 'cancelar' && kept.length !== acao.atendimentos.length) {
    body.atendimentoIds = kept;
  }
  const changed = Object.keys(body).length > 0;
  const valid = changed && reason.trim() && (!scheduled || (date && time)) && (acao.tipo !== 'cancelar' || kept.length > 0);
  const options = team?.filter((p) => isActive(p) || p.id === scheduled?.profissionalId) ?? [];

  return <WorkspaceDialog title="Modificar sugestão" pending={pending} onClose={onClose}>
    <form className="workspace-dialog-form" onSubmit={(event) => {
      event.preventDefault();
      if (valid) onSubmit({ ...body, motivo: reason.trim() });
    }}>
      <div className="workspace-dialog-content">
        <fieldset className="agenda-fields" disabled={pending}>
          <p className="agenda-hint"><strong>{suggestion.titulo}</strong><br />Ajuste o que precisar: a aprovação já vai para a agenda com as mudanças.</p>
          {scheduled && <>
            <label className="field"><span>{acao.tipo === 'transferir' ? 'Transferir para' : 'Profissional'}</span>
              {admin ? <select value={professional} onChange={(event) => setProfessional(event.target.value)} data-initial-focus>
                {!team && <option value={professional}>{scheduled.profissionalNome}</option>}
                {options.map((p) => <option key={p.id} value={p.id}>
                  {p.nome_completo}{p.horario_inicio && p.horario_fim ? ` (${p.horario_inicio.slice(0, 5)}–${p.horario_fim.slice(0, 5)})` : ''}
                </option>)}
              </select> : <input value={scheduled.profissionalNome} readOnly title="Só a coordenação pode trocar o profissional" />}
            </label>
            {acao.tipo === 'agendar' && <label className="field"><span>Tipo de atendimento</span>
              <select value={type} onChange={(event) => setType(event.target.value as AppointmentType)}>
                {Object.entries(appointmentTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>}
            <div className="suggestion-modify-row">
              <label className="field"><span>Data</span>
                <input type="date" value={date} min={dayKey.format(new Date())} required onChange={(event) => setDate(event.target.value)} />
              </label>
              <label className="field"><span>Horário de início</span>
                <input type="time" value={time} required onChange={(event) => setTime(event.target.value)} />
              </label>
            </div>
          </>}
          {acao.tipo === 'cancelar' && <div className="field"><span>Atendimentos a cancelar</span>
            <ul className="suggestion-modify-list">{acao.atendimentos.map((a) => <li key={a.id}>
              <label><input type="checkbox" checked={kept.includes(a.id)}
                onChange={(event) => setKept(event.target.checked ? [...kept, a.id] : kept.filter((id) => id !== a.id))} />
                {capitalize(longDate.format(new Date(a.dataInicio)))} às {toTime(a.dataInicio)}</label>
            </li>)}</ul>
            <small className="agenda-hint">Desmarque os que devem continuar na agenda.</small>
          </div>}
          <label className="field"><span>Motivo do ajuste</span>
            <textarea className="agenda-reason" maxLength={500} required value={reason}
              placeholder="Ex.: a família só pode às sextas" onChange={(event) => setReason(event.target.value)} />
          </label>
          {error && <p className="notice error" role="alert">{error}</p>}
        </fieldset>
      </div>
      <footer className="form-actions workspace-dialog-footer">
        <button type="button" className="back-button" disabled={pending} onClick={onClose}>Voltar</button>
        <button className="primary-button" disabled={pending || !valid}>{pending ? 'Aprovando…' : 'Aprovar com ajustes'}</button>
      </footer>
    </form>
  </WorkspaceDialog>;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

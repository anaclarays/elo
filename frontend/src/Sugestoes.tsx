import { CalendarMinus, Check, History, RefreshCw, TrendingUp, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from './api';
import { PageHeader, useRecords, type DataAccess } from './WorkspaceData';
import { WorkspaceDialog, type Notification } from './WorkspaceFeedback';

const endpoint = '/sugestoes';
const dateTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'short' });
const clock = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

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
}

interface SuggestionList { geradasEm: string; sugestoes: Suggestion[] }

interface Decision {
  id: string;
  tipo: SuggestionType;
  titulo: string;
  decisao: 'aprovada' | 'descartada';
  motivo: string | null;
  decididoEm: string;
  decididoPorNome: string;
}

type View = 'pending' | 'history';
type Action = { type: 'approve' | 'discard'; suggestion: Suggestion };

export function Sugestoes({ token, onExpired, onNotify, admin }: DataAccess & { onNotify: (notification: Notification) => void; admin: boolean }) {
  const [data, setData] = useState<SuggestionList>();
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('pending');
  const [action, setAction] = useState<Action>();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const history = useRecords<Decision>(view === 'history' ? `${endpoint}/historico` : null, token, onExpired);

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

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action) return;
    const motivo = reason.trim();
    if (action.type === 'discard' && !motivo) return;
    setPending(true);
    setSaveError('');
    try {
      await api(`${endpoint}/${action.suggestion.id}/${action.type === 'approve' ? 'aprovar' : 'descartar'}`,
        { token, method: 'POST', body: action.type === 'discard' ? { motivo } : {} });
      setAction(undefined);
      onNotify(action.type === 'approve'
        ? { message: 'Sugestão aprovada e aplicada na agenda', tone: 'success' }
        : { message: 'Sugestão descartada', tone: 'success' });
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

    <p className="suggestions-note">
      As sugestões vêm de regras sobre a capacidade semanal da equipe, a agenda e a lista de espera.
      Elas apoiam a decisão e não substituem a avaliação dos profissionais: nada muda na agenda sem aprovação.
      {!admin && ' Aqui aparecem as sugestões que mudam a sua agenda.'}
    </p>

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
            <button type="button" className="primary-button" onClick={() => open('approve', suggestion)}><Check size={17} aria-hidden="true" /> Aprovar</button>
          </div> : <p className="suggestion-locked">Muda a agenda de outro profissional: só a coordenação pode decidir.</p>}
        </li>;
      })}</ul>)}

    {view === 'history' && (history.error ? <div className="panel"><p className="notice error" role="alert">{history.error}</p>
      <button type="button" className="text-button" onClick={history.reload}>Tentar novamente</button></div>
      : !history.records ? <p className="agenda-message" role="status">Carregando histórico…</p>
      : !history.records.length ? <p className="agenda-message">Nenhuma sugestão foi aprovada ou descartada ainda.</p>
      : <ul className="decision-list">{history.records.map((decision) => <li key={decision.id}>
        <span className={`decision-badge ${decision.decisao}`}>{decision.decisao === 'aprovada' ? 'Aprovada' : 'Descartada'}</span>
        <div>
          <strong>{decision.titulo}</strong>
          <small>{types[decision.tipo]?.label ?? decision.tipo} · {decision.decididoPorNome} · {dateTime.format(new Date(decision.decididoEm))}</small>
          {decision.motivo && <p>Motivo: {decision.motivo}</p>}
        </div>
      </li>)}</ul>)}

    {action && <WorkspaceDialog title={action.type === 'approve' ? 'Aprovar sugestão' : 'Descartar sugestão'} size="compact"
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

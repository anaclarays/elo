import {
  CalendarCheck, CalendarClock, ChartNoAxesColumnIncreasing, ChevronDown, LayoutDashboard, ListPlus,
  LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, Sparkles, Trash2, Users, UserRoundCog, X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, areas, expiration, type Session } from './api';
import { Login, Recovery, Register, ResetPassword, Welcome } from './AuthPages';
import { Beneficiarios, type Beneficiario } from './Beneficiarios';
import { Team, TeamNotification, type TeamNotificationAction } from './Team';
import { PageHeader, useRecords, type DataAccess } from './WorkspaceData';

const overview = [
  { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard },
  { label: 'Beneficiários', path: '/beneficiarios', Icon: Users },
  { label: 'Sugestões de IA', path: '/sugestoes-ia', Icon: Sparkles },
];
const operations = [
  { label: 'Agenda Inteligente', path: '/agenda-inteligente', Icon: CalendarClock },
  { label: 'Lista de Espera', path: '/lista-de-espera', Icon: ListPlus },
];
const management = [
  { label: 'Relatórios & Indicadores', path: '/relatorios-indicadores', Icon: ChartNoAxesColumnIncreasing },
  { label: 'Equipe', path: '/equipe', Icon: UserRoundCog },
  { label: 'Configurações & LGPD', path: '/configuracoes-lgpd', Icon: ShieldCheck },
];
const navigation = [...overview, ...operations, ...management];
const sessionKey = 'elo.web.session';

function readSession(): Session | null {
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null') as Session | null;
    if (session?.profissional && expiration(session.accessToken) > Date.now()) return session;
    sessionStorage.removeItem(sessionKey);
  } catch {
    return null;
  }
  return null;
}

function NavigationGroup({ title, items }: { title: string; items: typeof navigation }) {
  return <div className="navigation-group">
    <h2>{title}</h2>
    {items.map(({ label, path, Icon }) => <NavLink to={path} key={path}>
      <Icon size={19} aria-hidden="true" /><span className="navigation-label">{label}</span>
    </NavLink>)}
  </div>;
}

function Workspace({ session, signOut }: { session: Session; signOut: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('elo.web.sidebar-collapsed') === 'true');
  const [profileOpen, setProfileOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLElement>(null);
  const profile = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const person = session.profissional;
  const admin = person.areaAtuacao === 'coordenacao_administrativa';
  const isTeam = admin && location.pathname === '/equipe';
  const page = navigation.find((item) => item.path === location.pathname);
  const initials = person.nomeCompleto.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (mobileOpen) closeButton.current?.focus();
  }, [mobileOpen]);

  useEffect(() => {
    const compact = window.matchMedia('(max-width: 900px)');
    const syncLayout = () => { if (!compact.matches) setMobileOpen(false); };
    compact.addEventListener('change', syncLayout);
    return () => compact.removeEventListener('change', syncLayout);
  }, []);

  function closeMobile() {
    setMobileOpen(false);
    requestAnimationFrame(() => menuButton.current?.focus());
  }

  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      localStorage.setItem('elo.web.sidebar-collapsed', String(!collapsed));
      return !collapsed;
    });
  }

  useEffect(() => {
    function handleClick(event: PointerEvent) {
      if (event.target instanceof Node && !profile.current?.contains(event.target)) setProfileOpen(false);
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, []);

  return <div className={`workspace${sidebarCollapsed ? ' sidebar-collapsed' : ''}`} onKeyDown={(event) => {
    if (event.key === 'Escape') {
      if (mobileOpen) closeMobile();
      if (profileOpen) {
        setProfileOpen(false);
        profile.current?.querySelector('button')?.focus();
      }
    }
  }}>
    <a href="#conteudo" className="skip-link">Ir para o conteúdo</a>
    {mobileOpen && <button className="drawer-backdrop" tabIndex={-1} aria-label="Fechar navegação" onClick={closeMobile} />}
    <aside id="sidebar" className={`sidebar${mobileOpen ? ' open' : ''}`}>
      <div className="brand-row">
        <Link className="brand" to="/dashboard">
          <img src="/logo-palavra-em-acao.png" alt="" width="58" height="44" />
          <span><strong>Palavra em Ação</strong><small>Módulo de Gestão · AESA</small></span>
        </Link>
        <button ref={closeButton} className="icon-button close-drawer" type="button" aria-label="Fechar menu" onClick={closeMobile}><X size={22} /></button>
      </div>
      <nav aria-label="Menu principal" onClick={(event) => {
        if (mobileOpen && event.target instanceof Element && event.target.closest('a')) {
          setMobileOpen(false);
          requestAnimationFrame(() => content.current?.focus());
        }
      }}>
        <NavigationGroup title="Visão Geral" items={overview} />
        <NavigationGroup title="Operação" items={operations} />
        {admin && <NavigationGroup title="Gestão" items={management} />}
      </nav>
    </aside>

    <div className="workspace-body" inert={mobileOpen}>
      <header className="topbar">
        <button className="icon-button desktop-sidebar-toggle" type="button" aria-controls="sidebar" aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'} aria-pressed={sidebarCollapsed} onClick={toggleSidebar}>
          {sidebarCollapsed ? <PanelLeftOpen size={21} /> : <PanelLeftClose size={21} />}
        </button>
        <button ref={menuButton} className="icon-button open-drawer" type="button" aria-controls="sidebar"
          aria-label="Abrir menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
        {isTeam ? <label className="field team-search"><span className="sr-only">Buscar profissionais</span>
          <span className="search-field"><Search size={19} aria-hidden="true" /><input type="search" value={teamQuery}
            placeholder="Buscar profissionais..." onChange={(event) => setTeamQuery(event.target.value)} /></span>
        </label> : <span className="current-page">{page?.label}</span>}
        <div className="profile" ref={profile}>
          <button className="profile-button" type="button" aria-label="Opções da conta" aria-expanded={profileOpen}
            aria-controls="profile-options" onClick={() => setProfileOpen(!profileOpen)}>
            <span className="avatar" aria-hidden="true">{initials}</span>
            <span className="profile-label"><strong>{person.nomeCompleto}</strong><small>{areas[person.areaAtuacao] ?? 'Área não informada'}</small></span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {profileOpen && <div className="profile-options" id="profile-options">
            <span className="profile-email">{person.email}</span>
            <button type="button" onClick={() => { signOut(); navigate('/login', { replace: true }); }}><LogOut size={17} aria-hidden="true" /> Sair</button>
          </div>}
        </div>
      </header>
      <main className="main-content" ref={content} id="conteudo" tabIndex={-1}><Outlet context={teamQuery} /></main>
    </div>
  </div>;
}

function Dashboard({ token, onExpired }: DataAccess) {
  const { records, error, reload } = useRecords<Beneficiario>('/pacientes', token, onExpired);
  const today = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());
  return <>
    <PageHeader title="Dashboard" description={`Visão geral da operação clínica e educacional · ${today}`} />
    <div className="dashboard-grid">
      <section className="panel">
        <h2>Painel Operacional</h2>
        <div className="operation-links">
          {operations.map(({ label, path, Icon }) => <Link to={path} key={path}><Icon size={20} aria-hidden="true" /> {label}</Link>)}
          <Link to="/sugestoes-ia"><Sparkles size={20} aria-hidden="true" /> Sugestões de IA</Link>
        </div>
      </section>
      <section className="panel dashboard-summary">
        <div className="summary-icon"><Users size={24} aria-hidden="true" /></div>
        <div><h2>Beneficiários ativos</h2>
          <p className="summary-number" aria-live="polite">{records?.length ?? '—'}</p>
          {error ? <button type="button" className="text-button" onClick={reload}>Tentar novamente</button> : <Link to="/beneficiarios">Ver beneficiários</Link>}
        </div>
      </section>
    </div>
  </>;
}

interface WaitingPatient {
  id: string;
  posicao: number;
  dataEntrada: string;
  tipoPaciente: 'beneficiario' | 'tea';
  pacienteId: string;
  numeroCadastro: string | null;
  nome: string;
  dataNascimento: string | null;
}

interface WaitlistProfessional {
  id: string;
  nome_completo: string;
  horario_inicio: string | null;
  horario_fim: string | null;
}

type PatientType = 'all' | WaitingPatient['tipoPaciente'];

const patientTypes: Record<WaitingPatient['tipoPaciente'], string> = {
  beneficiario: 'Aprendizagem',
  tea: 'TEA',
};

// Os mesmos tipos aceitos pelo backend em POST /atendimentos
const appointmentTypes = [
  { value: 'psicologia', label: 'Psicologia' },
  { value: 'terapia ocupacional', label: 'Terapia ocupacional' },
  { value: 'pedagogia', label: 'Pedagogia' },
];

function daysWaiting(dataEntrada: string): number | null {
  const enteredAt = new Date(dataEntrada).getTime();
  if (!Number.isFinite(enteredAt)) return null;
  return Math.max(0, Math.floor((Date.now() - enteredAt) / 86400000));
}

function patientAge(dataNascimento?: string | null): number | null {
  if (!dataNascimento) return null;
  const [year, month, day] = dataNascimento.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  return age >= 0 ? age : null;
}

// Data de hoje no formato AAAA-MM-DD, para o mínimo do campo de data
function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function workingHours(professional: WaitlistProfessional) {
  if (!professional.horario_inicio || !professional.horario_fim) return 'sem horário cadastrado';
  return `${professional.horario_inicio.slice(0, 5)}–${professional.horario_fim.slice(0, 5)}`;
}

function Waitlist({ token, onExpired, canManage }: DataAccess & { canManage: boolean }) {
  const [patientType, setPatientType] = useState<PatientType>('all');
  const [overThirtyDays, setOverThirtyDays] = useState(false);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [patients, setPatients] = useState<WaitingPatient[]>();
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  const [allocating, setAllocating] = useState<WaitingPatient | null>(null);
  const [professionals, setProfessionals] = useState<WaitlistProfessional[]>();
  const [professionalError, setProfessionalError] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [appointmentType, setAppointmentType] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [allocationError, setAllocationError] = useState('');

  const [removing, setRemoving] = useState<WaitingPatient | null>(null);
  const [reason, setReason] = useState('');
  const [removalError, setRemovalError] = useState('');

  useEffect(() => {
    let active = true;
    setPatients(undefined);
    setLoadError('');
    void api<WaitingPatient[]>('/lista-espera', { token })
      .then((data) => { if (active) setPatients(data); })
      .catch((failure: unknown) => {
        if (!active) return;
        if (failure instanceof ApiError && failure.status === 401) onExpired();
        else setLoadError(failure instanceof Error ? failure.message : 'Erro ao carregar a lista de espera.');
      });
    return () => { active = false; };
  }, [token, onExpired, revision]);

  // A lista de profissionais só é carregada uma vez, ao abrir o primeiro agendamento
  useEffect(() => {
    if (!allocating || professionals) return;
    let active = true;
    setProfessionalError('');
    void api<WaitlistProfessional[]>('/profissionais', { token })
      .then((data) => { if (active) setProfessionals(data); })
      .catch((failure: unknown) => {
        if (!active) return;
        if (failure instanceof ApiError && failure.status === 401) onExpired();
        else setProfessionalError(failure instanceof Error ? failure.message : 'Não foi possível carregar os profissionais.');
      });
    return () => { active = false; };
  }, [allocating, professionals, token, onExpired]);

  // "Alocar vaga" agenda o primeiro atendimento: o backend retira o paciente da fila na mesma operação (RN29)
  async function allocatePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allocating) return;
    setPending(true);
    setAllocationError('');
    const isTea = allocating.tipoPaciente === 'tea';
    try {
      await api('/atendimentos', {
        token,
        body: {
          pacienteId: isTea ? allocating.pacienteId : Number(allocating.pacienteId),
          isTea,
          profissionalId: professionalId,
          // Horário de Recife (UTC-3, sem horário de verão)
          dataInicio: `${appointmentDate}T${appointmentTime}:00-03:00`,
          tipo: appointmentType,
        },
      });
      const professional = professionals?.find(({ id }) => id === professionalId);
      const [year, month, day] = appointmentDate.split('-');
      setAllocating(null);
      setNotice(`Atendimento de ${allocating.nome} agendado para ${day}/${month}/${year} às ${appointmentTime}${professional ? ` com ${professional.nome_completo}` : ''}. A família saiu da lista de espera.`);
      setRevision((current) => current + 1);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setAllocationError(failure instanceof Error ? failure.message : 'Não foi possível agendar o atendimento.');
    } finally {
      setPending(false);
    }
  }

  async function removePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!removing) return;
    setPending(true);
    setRemovalError('');
    try {
      await api(`/lista-espera/${removing.id}/retirar`, { token, method: 'PATCH', body: { justificativa: reason } });
      setRemoving(null);
      setReason('');
      setNotice(`${removing.nome} foi retirado(a) da lista de espera.`);
      setRevision((current) => current + 1);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setRemovalError(failure instanceof Error ? failure.message : 'Não foi possível retirar o paciente da lista.');
    } finally {
      setPending(false);
    }
  }

  function openAllocation(patient: WaitingPatient) {
    setNotice('');
    setAllocationError('');
    setProfessionalId('');
    setAppointmentType('');
    setAppointmentDate('');
    setAppointmentTime('');
    setAllocating(patient);
  }

  function closeAllocation() {
    if (pending) return;
    setAllocating(null);
  }

  function openRemoval(patient: WaitingPatient) {
    setNotice('');
    setRemovalError('');
    setReason('');
    setRemoving(patient);
  }

  function closeRemoval() {
    if (pending) return;
    setRemoving(null);
    setReason('');
    setRemovalError('');
  }

  const searchTerm = search.trim().toLocaleLowerCase('pt-BR');
  const filteredPatients = patients?.filter((patient) => {
    if (patientType !== 'all' && patient.tipoPaciente !== patientType) return false;
    if (overThirtyDays && (daysWaiting(patient.dataEntrada) ?? 0) <= 30) return false;
    return !searchTerm || patient.nome.toLocaleLowerCase('pt-BR').includes(searchTerm);
  });
  const canSchedule = Boolean(professionalId && appointmentType && appointmentDate && appointmentTime);

  return <>
    <header className="page-heading waitlist-heading">
      <div>
        <h1>Lista de Espera</h1>
        <p>{patients
          ? `${patients.length} ${patients.length === 1 ? 'família aguardando alocação, ordenada' : 'famílias aguardando alocação, ordenadas'} por entrada na fila`
          : 'Famílias aguardando alocação, ordenadas por entrada na fila'}</p>
      </div>
    </header>
    {notice && <p className="notice success waitlist-notice" role="status">{notice}</p>}
    <div className="waitlist-toolbar">
      <div className="waitlist-filters" role="group" aria-label="Filtros da lista de espera">
        {(['all', 'beneficiario', 'tea'] as const).map((type) => <button key={type} type="button"
          className={`waitlist-filter${patientType === type ? ' active' : ''}`} aria-pressed={patientType === type}
          onClick={() => setPatientType(type)}>{type === 'all' ? 'Todos' : patientTypes[type]}</button>)}
        <button type="button" className={`waitlist-filter${overThirtyDays ? ' active' : ''}`} aria-pressed={overThirtyDays}
          onClick={() => setOverThirtyDays((current) => !current)}>+30 dias</button>
      </div>
      <label className="waitlist-search">
        <span className="sr-only">Buscar por nome</span>
        <input type="search" placeholder="Buscar por nome" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
    </div>
    <section className="panel waitlist-panel" aria-label="Famílias aguardando alocação">
      {loadError ? <>
        <p className="notice error" role="alert">{loadError}</p>
        <button type="button" className="text-button" onClick={() => setRevision((current) => current + 1)}>Tentar novamente</button>
      </> : !patients ? <p className="waitlist-state" role="status">Carregando lista de espera…</p>
        : !filteredPatients?.length ? <p className="waitlist-state" role="status">{patients.length ? 'Nenhuma família corresponde a estes filtros.' : 'Nenhuma família encontrada na lista de espera.'}</p>
          : <div className="table-scroll waitlist-table"><table>
            <thead><tr>
              <th scope="col">Posição</th><th scope="col">Criança</th><th scope="col">Cadastro</th>
              <th scope="col">Espera</th>{canManage && <th scope="col" className="actions-heading">Ações</th>}
            </tr></thead>
            <tbody>{filteredPatients.map((patient) => {
              const waitingDays = daysWaiting(patient.dataEntrada);
              const age = patientAge(patient.dataNascimento);
              return <tr key={patient.id}>
                <td className="waitlist-position">{patient.posicao}º</td>
                <td className="waitlist-child">
                  <strong>{patient.nome}</strong>
                  <small>{age === null ? 'Idade não informada' : `${age} ${age === 1 ? 'ano' : 'anos'}`}</small>
                </td>
                <td className="waitlist-child">
                  <span className="waitlist-type">{patientTypes[patient.tipoPaciente]}</span>
                  <small>Nº {patient.numeroCadastro ?? '—'}</small>
                </td>
                <td className="waitlist-days">{waitingDays === null ? '—' : `${waitingDays} ${waitingDays === 1 ? 'dia' : 'dias'}`}</td>
                {canManage && <td><div className="waitlist-actions">
                  <button className="allocate-button" type="button" onClick={() => openAllocation(patient)}><CalendarCheck size={15} aria-hidden="true" /> Alocar Vaga</button>
                  <button className="waitlist-trash" type="button" aria-label={`Retirar ${patient.nome} da fila`} title="Retirar da fila" onClick={() => openRemoval(patient)}><Trash2 size={16} aria-hidden="true" /></button>
                </div></td>}
              </tr>;
            })}</tbody>
          </table></div>}
    </section>
    {allocating && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAllocation(); }}>
      <form className="modal-card allocation-modal" onSubmit={allocatePatient} role="dialog" aria-modal="true" aria-labelledby="allocation-title">
        <header className="modal-header">
          <h2 id="allocation-title">Alocar Vaga</h2>
          <button className="modal-close" type="button" aria-label="Fechar" disabled={pending} onClick={closeAllocation}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="modal-body">
          <p>Agende o primeiro atendimento de <strong>{allocating.nome}</strong>. Ao confirmar, a família sai da lista de espera.</p>
          <label className="field"><span>Profissional responsável</span>
            <select required value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} disabled={pending || !professionals?.length}>
              <option value="">{professionals ? 'Selecione um profissional' : 'Carregando profissionais…'}</option>
              {professionals?.map((professional) => <option key={professional.id} value={professional.id}>{professional.nome_completo} ({workingHours(professional)})</option>)}
            </select>
          </label>
          {professionals && !professionals.length && <p className="modal-hint" role="status">Nenhum profissional ativo está disponível.</p>}
          {professionalError && <p className="notice error" role="alert">{professionalError}</p>}
          <label className="field"><span>Tipo de atendimento</span>
            <select required value={appointmentType} onChange={(event) => setAppointmentType(event.target.value)} disabled={pending}>
              <option value="">Selecione o tipo</option>
              {appointmentTypes.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="modal-row">
            <label className="field"><span>Data</span>
              <input type="date" required min={todayIso()} value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} disabled={pending} />
            </label>
            <label className="field"><span>Horário</span>
              <input type="time" required value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} disabled={pending} />
            </label>
          </div>
          <p className="modal-hint">Cada atendimento dura 20 minutos e precisa caber no horário do profissional.</p>
          {allocationError && <p className="notice error" role="alert">{allocationError}</p>}
        </div>
        <footer className="modal-footer">
          <button className="back-button" type="button" disabled={pending} onClick={closeAllocation}>Cancelar</button>
          <button className="confirm-allocation" type="submit" disabled={pending || !canSchedule}>
            {pending ? 'Agendando…' : 'Confirmar Alocação'}
          </button>
        </footer>
      </form>
    </div>}
    {removing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRemoval(); }}>
      <form className="modal-card removal-modal" onSubmit={removePatient} role="dialog" aria-modal="true" aria-labelledby="remove-title">
        <header className="modal-header">
          <h2 id="remove-title">Retirar da fila</h2>
          <button className="modal-close" type="button" aria-label="Fechar" disabled={pending} onClick={closeRemoval}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="modal-body">
          <p>Informe a justificativa para retirar <strong>{removing.nome}</strong> da fila.</p>
          <label className="field"><span>Justificativa</span><textarea required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} /></label>
          {removalError && <p className="notice error" role="alert">{removalError}</p>}
        </div>
        <footer className="modal-footer">
          <button className="back-button" type="button" disabled={pending} onClick={closeRemoval}>Cancelar</button>
          <button className="primary-button" type="submit" disabled={pending || !reason.trim()}>{pending ? 'Retirando…' : 'Confirmar retirada'}</button>
        </footer>
      </form>
    </div>}
  </>;
}

function PendingModule({ title }: { title: string }) {
  return <><PageHeader title={title} description="Este módulo está em desenvolvimento." />
    <Link to="/dashboard">Voltar para o Dashboard</Link></>;
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const [teamNotification, setTeamNotification] = useState<{ action: TeamNotificationAction }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    if (!teamNotification) return;
    const timer = window.setTimeout(() => setTeamNotification(undefined), 2000);
    return () => window.clearTimeout(timer);
  }, [teamNotification]);

  function signIn(newSession: Session) {
    sessionStorage.setItem(sessionKey, JSON.stringify(newSession));
    setSession(newSession);
  }

  const signOut = useRef(() => {
    sessionStorage.removeItem(sessionKey);
    setSession(null);
  }).current;
  const sessionExpired = useRef(() => {
    signOut();
    navigate('/login', { replace: true });
  }).current;

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(signOut, Math.max(expiration(session.accessToken) - Date.now(), 0));
    return () => window.clearTimeout(timer);
  }, [session, signOut]);

  const home = <Navigate to="/dashboard" replace />;
  const login = <Navigate to="/login" replace />;
  const dataAccess = { token: session?.accessToken ?? '', onExpired: sessionExpired };
  return <>
    <TeamNotification action={teamNotification?.action} />
    <Routes>
      <Route path="/" element={session ? home : login} />
      <Route path="/inicio" element={session ? home : <Welcome />} />
      <Route path="/login" element={session ? home : <Login onSession={signIn} />} />
      <Route path="/cadastro" element={session ? home : <Register onSession={signIn} />} />
      <Route path="/recuperar-senha" element={<Recovery />} />
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route element={session ? <Workspace session={session} signOut={signOut} /> : login}>
        <Route path="/dashboard" element={<Dashboard {...dataAccess} />} />
        <Route path="/beneficiarios" element={<Beneficiarios {...dataAccess} />} />
        {[overview[2], operations[0]].map(({ path, label }) => <Route key={path} path={path} element={<PendingModule title={label} />} />)}
        <Route path="/lista-de-espera" element={<Waitlist {...dataAccess} canManage={session?.profissional.areaAtuacao === 'coordenacao_administrativa'} />} />
        <Route path="/equipe" element={session?.profissional.areaAtuacao === 'coordenacao_administrativa'
          ? <Team {...dataAccess} onNotify={(action) => setTeamNotification({ action })} /> : home} />
        <Route element={session?.profissional.areaAtuacao === 'coordenacao_administrativa' ? <Outlet /> : home}>
          {[management[0], management[2]].map(({ path, label }) => <Route key={path} path={path} element={<PendingModule title={label} />} />)}
        </Route>
      </Route>
      <Route path="*" element={session ? home : login} />
    </Routes>
  </>;
}

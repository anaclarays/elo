import {
  CalendarCheck, CalendarClock, ChartNoAxesColumnIncreasing, ChevronDown, LayoutDashboard, ListPlus,
  LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck, Sparkles, Trash2, Users, UserRoundCog, X,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError, areas, expiration, type Area, type Session } from './api';
import { Login, Recovery, Register, ResetPassword, Welcome } from './AuthPages';
import { Beneficiarios, type Beneficiario } from './Beneficiarios';
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
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLElement>(null);
  const profile = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const person = session.profissional;
  const admin = person.areaAtuacao === 'coordenacao_administrativa';
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
        <span className="current-page">{page?.label}</span>
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
      <main className="main-content" ref={content} id="conteudo" tabIndex={-1}><Outlet /></main>
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

interface TeamMember {
  id: string;
  nome_completo: string;
  area_atuacao: Area;
  cargo: string | null;
  capacidade_semanal: number | null;
  status: string | null;
}

interface WaitingPatient {
  id: string;
  dataEntrada?: string | null;
  tipoPaciente: 'beneficiario' | 'tea';
  pacienteId: number | string;
  nome: string;
  dataNascimento?: string | null;
  responsavel?: string | null;
  suspeitaDiagnostica?: string | null;
  prioridade?: string | null;
  vulnerabilidade?: string | null;
}

interface WaitlistProfessional {
  id: string;
  nome_completo: string;
  horario_inicio: string | null;
  horario_fim: string | null;
}

type WaitlistFilter = 'all' | 'high-priority' | 'over-30-days';
function daysWaiting(dataEntrada?: string | null): number | null {
  if (!dataEntrada) return null;
  const enteredAt = new Date(dataEntrada).getTime();
  if (!Number.isFinite(enteredAt)) return null;
  return Math.max(0, Math.floor((Date.now() - enteredAt) / 86400000));
}

function isOverThirtyDays(dataEntrada?: string | null): boolean {
  if (!dataEntrada) return false;
  const enteredAt = new Date(dataEntrada).getTime();
  return Number.isFinite(enteredAt) && Date.now() - enteredAt > 30 * 86400000;
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

function normalizedBadge(value?: string | null): { label: string; tone: string } {
  const label = value?.trim();
  if (!label) return { label: '—', tone: 'empty' };
  const normalized = label.toLocaleLowerCase('pt-BR');
  if (normalized === 'alta' || normalized === 'alta prioridade') return { label: 'Alta', tone: 'high' };
  if (normalized === 'média' || normalized === 'media') return { label: 'Média', tone: 'medium' };
  if (normalized === 'baixa') return { label: 'Baixa', tone: 'low' };
  return { label, tone: 'empty' };
}

function isHighPriority(patient: WaitingPatient) {
  return normalizedBadge(patient.prioridade).tone === 'high';
}

function Waitlist({ token, onExpired }: DataAccess) {
  const [filter, setFilter] = useState<WaitlistFilter>('all');
  const [revision, setRevision] = useState(0);
  const [patients, setPatients] = useState<WaitingPatient[]>();
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [allocating, setAllocating] = useState<WaitingPatient | null>(null);
  const [professionals, setProfessionals] = useState<WaitlistProfessional[]>();
  const [professionalError, setProfessionalError] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [removing, setRemoving] = useState<WaitingPatient | null>(null);
  const [reason, setReason] = useState('');
  const [removalError, setRemovalError] = useState('');
  const [pending, setPending] = useState(false);

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

  useEffect(() => {
    if (!allocating) return;
    let active = true;
    setProfessionals(undefined);
    setProfessionalError('');
    void api<WaitlistProfessional[]>('/profissionais', { token })
      .then((data) => { if (active) setProfessionals(data); })
      .catch((failure: unknown) => {
        if (!active) return;
        if (failure instanceof ApiError && failure.status === 401) onExpired();
        else setProfessionalError(failure instanceof Error ? failure.message : 'Não foi possível carregar os profissionais.');
      });
    return () => { active = false; };
  }, [allocating, token, onExpired]);

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
    setProfessionalId('');
    setAllocating(patient);
  }

  function closeAllocation() {
    if (pending) return;
    setAllocating(null);
  }

  function closeRemoval() {
    if (pending) return;
    setRemoving(null);
    setReason('');
    setRemovalError('');
  }

  const hasPriorityData = Boolean(patients?.some((patient) => patient.prioridade?.trim()));
  const filteredPatients = patients?.filter((patient) => {
    if (filter === 'high-priority') return isHighPriority(patient);
    if (filter === 'over-30-days') return isOverThirtyDays(patient.dataEntrada);
    return true;
  });
  const allocatedPatientAge = allocating ? patientAge(allocating.dataNascimento) : null;

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
    <div className="waitlist-filters" role="group" aria-label="Filtros da lista de espera">
      <button type="button" className={`waitlist-filter${filter === 'all' ? ' active' : ''}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todos</button>
      <span className="waitlist-filter-tooltip" title={!hasPriorityData ? 'O backend não retorna prioridade para os itens da fila.' : undefined}>
        <button type="button" className={`waitlist-filter${filter === 'high-priority' ? ' active' : ''}`} aria-pressed={filter === 'high-priority'} disabled={!hasPriorityData} aria-label={!hasPriorityData ? 'Alta Prioridade (indisponível: o backend não retorna prioridade)' : undefined} onClick={() => setFilter('high-priority')}>Alta Prioridade</button>
      </span>
      <button type="button" className={`waitlist-filter${filter === 'over-30-days' ? ' active' : ''}`} aria-pressed={filter === 'over-30-days'} onClick={() => setFilter('over-30-days')}>+30 dias</button>
    </div>
    <section className="panel waitlist-panel" aria-label="Famílias aguardando alocação">
      {loadError ? <>
        <p className="notice error" role="alert">{loadError}</p>
        <button type="button" className="text-button" onClick={() => setRevision((current) => current + 1)}>Tentar novamente</button>
      </> : !patients ? <p className="waitlist-state" role="status">Carregando lista de espera…</p>
        : !filteredPatients?.length ? <p className="waitlist-state" role="status">{patients.length ? 'Nenhuma família corresponde a este filtro.' : 'Nenhuma família encontrada na lista de espera.'}</p>
          : <div className="table-scroll waitlist-table"><table>
            <thead><tr>
              <th scope="col">Criança</th><th scope="col">Suspeita diagnóstica</th><th scope="col">Espera</th>
              <th scope="col">Prioridade</th><th scope="col">Vulnerabilidade</th><th scope="col" className="actions-heading">Ações</th>
            </tr></thead>
            <tbody>{filteredPatients.map((patient) => {
              const priority = normalizedBadge(patient.prioridade);
              const vulnerability = normalizedBadge(patient.vulnerabilidade);
              const waitingDays = daysWaiting(patient.dataEntrada);
              return <tr key={patient.id}>
                <td className="waitlist-child">
                  <strong>{patient.nome || '—'}</strong>
                  <small>{patientAge(patient.dataNascimento) ?? '—'} anos · resp. {patient.responsavel?.trim() || '—'}</small>
                </td>
                <td>{patient.suspeitaDiagnostica?.trim() || '—'}</td>
                <td className="waitlist-days">{waitingDays === null ? '—' : `${waitingDays}d`}</td>
                <td><span className={`waitlist-badge ${priority.tone}`}>{priority.label}</span></td>
                <td><span className={`waitlist-badge ${vulnerability.tone}`}>{vulnerability.label}</span></td>
                <td className="waitlist-actions">
                  <button className="allocate-button" type="button" onClick={() => openAllocation(patient)}><CalendarCheck size={15} aria-hidden="true" /> Alocar Vaga</button>
                  <button className="waitlist-trash" type="button" aria-label="Retirar da fila" title="Retirar da fila" onClick={() => {
                    setNotice('');
                    setRemovalError('');
                    setReason('');
                    setRemoving(patient);
                  }}><Trash2 size={16} aria-hidden="true" /></button>
                </td>
              </tr>;
            })}</tbody>
          </table></div>}
    </section>
    {allocating && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAllocation(); }}>
      <div className="modal-card allocation-modal" role="dialog" aria-modal="true" aria-labelledby="allocation-title">
        <header className="modal-header">
          <h2 id="allocation-title">Alocar Vaga</h2>
          <button className="modal-close" type="button" aria-label="Fechar" disabled={pending} onClick={closeAllocation}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="modal-body">
          <p><strong>{allocating.nome}</strong> será movido(a) da fila de espera para a agenda de atendimento ativo.</p>
          <label className="field"><span>Profissional responsável</span>
            <select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} disabled={!professionals?.length}>
              <option value="">Selecione um profissional</option>
              {professionals?.map((professional) => <option key={professional.id} value={professional.id}>{professional.nome_completo}</option>)}
            </select>
          </label>
          {!professionals && !professionalError && <p className="modal-hint" role="status">Carregando profissionais…</p>}
          {professionals && !professionals.length && <p className="modal-hint" role="status">Nenhum profissional ativo está disponível.</p>}
          {professionalError && <p className="notice error" role="alert">{professionalError}</p>}
          <p className="notice error" role="status">A aloca??o ainda n?o pode ser salva: o backend precisa oferecer suporte para registrar o profissional respons?vel sem criar um atendimento.</p>
        </div>
        <footer className="modal-footer">
          <button className="back-button" type="button" disabled={pending} onClick={closeAllocation}>Cancelar</button>
          <button className="confirm-allocation" type="button" disabled title="Aguardando suporte para persistir aloca??es no backend">
            {pending ? 'Confirmando…' : 'Confirmar Alocação'}
          </button>
        </footer>
      </div>
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

function Team({ token, onExpired }: DataAccess) {
  const [area, setArea] = useState('');
  const { records, error, reload } = useRecords<TeamMember>('/profissionais', token, onExpired);
  const filtered = records?.filter((person) => !area || person.area_atuacao === area);
  return <>
    <PageHeader title="Equipe" description="Consulte a equipe por área de atuação." />
    <section className="panel">
      <label className="field filter-field"><span>Área de atuação</span>
        <select value={area} onChange={(event) => setArea(event.target.value)}>
          <option value="">Todas as áreas</option>
          {Object.entries(areas).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {error ? <><p className="notice error" role="alert">{error}</p><button type="button" className="text-button" onClick={reload}>Tentar novamente</button></>
        : !filtered ? <p role="status">Carregando equipe…</p>
        : !filtered.length ? <p role="status">Nenhum profissional encontrado.</p>
        : <div className="table-scroll"><table>
          <thead><tr><th scope="col">Nome</th><th scope="col">Área de atuação</th><th scope="col">Cargo</th><th scope="col">Capacidade semanal</th><th scope="col">Status</th></tr></thead>
          <tbody>{filtered.map((person) => <tr key={person.id}>
            <td>{person.nome_completo}</td><td>{areas[person.area_atuacao] ?? '—'}</td>
            <td>{person.cargo || '—'}</td><td>{person.capacidade_semanal ?? '—'}</td><td>{person.status || '—'}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  </>;
}

function PendingModule({ title }: { title: string }) {
  return <><PageHeader title={title} description="Este módulo está em desenvolvimento." />
    <Link to="/dashboard">Voltar para o Dashboard</Link></>;
}

export default function App() {
  const [session, setSession] = useState(readSession);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

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
  return <Routes>
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
      <Route path="/lista-de-espera" element={<Waitlist {...dataAccess} />} />
      <Route element={session?.profissional.areaAtuacao === 'coordenacao_administrativa' ? <Outlet /> : home}>
        <Route path="/equipe" element={<Team {...dataAccess} />} />
        {[management[0], management[2]].map(({ path, label }) => <Route key={path} path={path} element={<PendingModule title={label} />} />)}
      </Route>
    </Route>
    <Route path="*" element={session ? home : login} />
  </Routes>;
}

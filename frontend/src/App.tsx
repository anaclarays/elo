import {
  CalendarClock, ChartNoAxesColumnIncreasing, ChevronDown, LayoutDashboard, ListPlus,
  LogOut, Menu, ShieldCheck, Sparkles, Users, UserRoundCog, X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { areas, expiration, type Area, type Session } from './api';
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
      <Icon size={19} aria-hidden="true" /><span>{label}</span>
    </NavLink>)}
  </div>;
}

function Workspace({ session, signOut }: { session: Session; signOut: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
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

  useEffect(() => {
    function handleClick(event: PointerEvent) {
      if (event.target instanceof Node && !profile.current?.contains(event.target)) setProfileOpen(false);
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, []);

  return <div className="workspace" onKeyDown={(event) => {
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
      {[overview[2], ...operations].map(({ path, label }) => <Route key={path} path={path} element={<PendingModule title={label} />} />)}
      <Route element={session?.profissional.areaAtuacao === 'coordenacao_administrativa' ? <Outlet /> : home}>
        <Route path="/equipe" element={<Team {...dataAccess} />} />
        {[management[0], management[2]].map(({ path, label }) => <Route key={path} path={path} element={<PendingModule title={label} />} />)}
      </Route>
    </Route>
    <Route path="*" element={session ? home : login} />
  </Routes>;
}

import { CalendarCheck, ChartNoAxesColumnIncreasing, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, ApiError } from './api';
import type { Beneficiario } from './Beneficiarios';
import { PageHeader, useRecords, type DataAccess } from './WorkspaceData';

interface Periodo {
  dataInicio: string | null;
  dataFim: string | null;
}

interface Relatorio {
  pacientes: {
    ativos: { total: number };
    teaAtivosPorNivelSuporte: { nivel1: number; nivel2: number; nivel3: number };
  };
  atendimentos: {
    total: number;
    cancelados: number;
    taxaCancelamentoPercentual: number | null;
    porProfissional: { profissionalId: string; nome: string; total: number }[];
  };
}

interface PacienteTea {
  id: string;
  nome_completo: string;
  data_cadastro: string;
  nivel_suporte: number;
  aguarda_diagnostico: boolean;
}

const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife', dateStyle: 'short' });
const number = new Intl.NumberFormat('pt-BR');
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

function selectedDates(days: string): Periodo {
  if (days === 'all') return { dataInicio: null, dataFim: null };
  const dataFim = calendar.format(new Date());
  const start = new Date(`${dataFim}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - Number(days) + 1);
  return { dataInicio: start.toISOString().slice(0, 10), dataFim };
}

function searchText(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('pt-BR');
}

type Bar = { key: string; label: string; total: number };

function BarChart({ id, title, rows, empty }: { id: string; title: string; rows: Bar[]; empty: string }) {
  const max = rows.reduce((largest, row) => Math.max(largest, row.total), 1);
  return <section className={`panel reports-chart ${id}`} aria-labelledby={id}>
    <h2 id={id}>{title}</h2>
    {rows.length ? <ul>
      {rows.map(({ key, label, total }) => <li key={key}>
        <span>{label}</span>
        <span className="reports-track" aria-hidden="true"><span style={{ width: `${total / max * 100}%` }} /></span>
        <strong>{number.format(total)}</strong>
      </li>)}
    </ul> : <p className="reports-state" role="status">{empty}</p>}
  </section>;
}

function Indicators({ path, token, onExpired, query }: DataAccess & { path: string; query: string }) {
  const [report, setReport] = useState<Relatorio>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void api<Relatorio>(path, { token }).then((data) => {
      if (active) setReport(data);
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'Não foi possível carregar os indicadores.');
    });
    return () => { active = false; };
  }, [path, token, onExpired, revision]);

  if (error) return <section className="panel">
    <p className="notice error" role="alert">{error}</p>
    <button className="text-button" type="button" onClick={() => {
      setError('');
      setRevision((previous) => previous + 1);
    }}>Tentar carregar os indicadores novamente</button>
  </section>;

  if (!report) return <p className="panel reports-state" role="status">Carregando indicadores…</p>;

  const { pacientes, atendimentos } = report;
  const { nivel1, nivel2, nivel3 } = pacientes.teaAtivosPorNivelSuporte;
  const cards = [
    { label: 'Beneficiários ativos', Icon: Users, value: number.format(pacientes.ativos.total) },
    { label: 'Sessões no período', Icon: CalendarCheck, value: number.format(atendimentos.total) },
    { label: 'Taxa de cancelamento', Icon: ChartNoAxesColumnIncreasing,
      value: atendimentos.taxaCancelamentoPercentual === null ? '—' : percent.format(atendimentos.taxaCancelamentoPercentual / 100),
      detail: atendimentos.total ? `${number.format(atendimentos.cancelados)} ${atendimentos.cancelados === 1 ? 'sessão cancelada' : 'sessões canceladas'}` : 'Sem sessões no período' },
  ];
  const levels = [nivel1, nivel2, nivel3].map((total, index) => ({ key: String(index + 1), label: `Nível ${index + 1}`, total }));
  const professionals = atendimentos.porProfissional
    .filter(({ nome }) => searchText(nome).includes(query))
    .map(({ profissionalId, nome, total }) => ({ key: profissionalId, label: nome, total }));

  return <>
    <div className="reports-metrics">
      {cards.map(({ label, Icon, value, detail }) => <section className="panel reports-metric" key={label}>
        <span className="reports-metric-icon"><Icon size={21} aria-hidden="true" /></span>
        <div><h2>{label}</h2><p>{value}</p>{detail && <small>{detail}</small>}</div>
      </section>)}
    </div>
    <div className="reports-charts">
      <BarChart id="reports-support" title="Pacientes TEA ativos por nível de suporte" rows={levels} empty="Sem pacientes TEA ativos." />
      <BarChart id="reports-professionals" title="Atendimentos agendados por profissional" rows={professionals}
        empty={query && atendimentos.porProfissional.length ? 'Nenhum profissional encontrado para esta busca.' : 'Nenhum atendimento agendado no período.'} />
    </div>
  </>;
}

function RecentPatients({ token, onExpired, period, query }: DataAccess & { period: Periodo; query: string }) {
  const beneficiaries = useRecords<Beneficiario>('/pacientes', token, onExpired);
  const tea = useRecords<PacienteTea>('/pacientes-tea', token, onExpired);
  const error = beneficiaries.error || tea.error;
  const rows = beneficiaries.records && tea.records && [
    ...beneficiaries.records.map((patient) => ({
      key: `beneficiario-${patient.id}`, name: patient.nomeBeneficiario, type: 'Aprendizagem', support: '—',
      date: calendar.format(new Date(patient.dataCadastro)),
    })),
    ...tea.records.map((patient) => ({
      key: `tea-${patient.id}`, name: patient.nome_completo, type: 'TEA',
      support: patient.aguarda_diagnostico ? 'Aguarda diagnóstico' : `Nível ${patient.nivel_suporte}`,
      date: patient.data_cadastro.slice(0, 10),
    })),
  ].filter(({ name, date }) => searchText(name).includes(query)
    && (!period.dataInicio || date >= period.dataInicio)
    && (!period.dataFim || date <= period.dataFim))
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 6);

  function retry() {
    if (beneficiaries.error) beneficiaries.reload();
    if (tea.error) tea.reload();
  }

  return <section className="panel reports-recent" aria-labelledby="reports-recent-title">
    <header>
      <h2 id="reports-recent-title">Pacientes recentes</h2>
      <Link to="/beneficiarios">Ver beneficiários <span aria-hidden="true">→</span></Link>
    </header>
    {error ? <div className="reports-state">
      <p className="notice error" role="alert">{error}</p>
      <button type="button" className="text-button" onClick={retry}>Tentar carregar os pacientes novamente</button>
    </div> : !rows ? <p className="reports-state" role="status">Carregando pacientes…</p>
      : !rows.length ? <p className="reports-state" role="status">{query ? 'Nenhum paciente encontrado para esta busca no período.' : 'Nenhum paciente cadastrado no período.'}</p>
      : <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="reports-recent-title">
        <table aria-labelledby="reports-recent-title">
          <thead><tr><th scope="col">Paciente</th><th scope="col">Tipo de cadastro</th><th scope="col">Nível de suporte</th><th scope="col">Data de cadastro</th></tr></thead>
          <tbody>{rows.map(({ key, name, type, support, date }) => <tr key={key}>
            <th scope="row">{name}</th><td><span className="reports-patient-type" data-type={type}>{type}</span></td>
            <td>{support}</td><td><time dateTime={date}>{date.split('-').reverse().join('/')}</time></td>
          </tr>)}</tbody>
        </table>
      </div>}
  </section>;
}

export function Relatorios({ token, onExpired }: DataAccess) {
  const [days, setDays] = useState('30');
  const query = searchText(useOutletContext<string>() ?? '');
  const period = selectedDates(days);
  const path = period.dataInicio && period.dataFim
    ? `/relatorios?${new URLSearchParams({ dataInicio: period.dataInicio, dataFim: period.dataFim })}`
    : '/relatorios';

  return <div className="reports-page">
    <PageHeader title="Relatórios & Indicadores" description="Indicadores consolidados da operação clínica e social" action={
      <label className="field reports-period"><span className="sr-only">Período do relatório</span>
        <select value={days} onChange={(event) => setDays(event.target.value)}>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="all">Todo o período</option>
        </select>
      </label>
    } />
    <Indicators key={path} path={path} token={token} onExpired={onExpired} query={query} />
    <RecentPatients token={token} onExpired={onExpired} period={period} query={query} />
  </div>;
}

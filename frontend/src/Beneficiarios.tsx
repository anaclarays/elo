import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from 'react';
import { api, ApiError, areas, type Area } from './api';
import { formatCpf } from './AuthPages';
import { PageHeader, useRecords, type DataAccess } from './WorkspaceData';
import { WorkspaceDialog, type Notification } from './WorkspaceFeedback';

const endpoint = '/pacientes';
const stateCodes = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const complaints = { motora: 'Motora', leitura: 'Leitura', escrita: 'Escrita', 'lógica matemática': 'Lógica matemática' };
const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife', dateStyle: 'short' });
const requiredFields = [
  'numeroCadastro', 'nomeBeneficiario', 'dataNascimento', 'rg', 'cpf', 'nomeMae', 'contato', 'email',
  'endereco', 'numero', 'bairro', 'cidade', 'cep', 'estado', 'escolaFrequenta', 'serie',
] as const;
const optionalFields = ['nomePai', 'acompanhanteEscolar'] as const;
const questions = [
  ['possuiIrmaos', 'Possui irmãos?', ['quantidadeIrmaos', 'nomesIrmaos']],
  ['possuiDeficit', 'Possui algum déficit ou transtorno de aprendizado?', ['queixa']],
  ['fazAcompanhamento', 'Faz acompanhamento terapêutico?', ['quaisAcompanhamentos']],
  ['fazUsoMedicacao', 'Faz uso de medicações?', ['quaisMedicacoes']],
] as const;

type RequiredField = typeof requiredFields[number];
type OptionalField = typeof optionalFields[number];
type Question = typeof questions[number][0];
type DetailField = typeof questions[number][2][number];
type BeneficiaryFields = Record<RequiredField, string> & Record<Question, boolean>
  & Partial<Record<Exclude<DetailField, 'quantidadeIrmaos'> | OptionalField, string | null>>
  & { quantidadeIrmaos?: number | null };

export interface Beneficiario extends BeneficiaryFields {
  id: number;
  dataCadastro: string;
  ativo: boolean;
}

type Action = { type: 'create' } | { type: 'edit' | 'remove' | 'history'; person: Beneficiario };

function dateOnly(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : calendar.format(date);
}

function displayDate(value: string) {
  return dateOnly(value).split('-').reverse().join('/');
}

function ageAt(birthDate: string, today: string) {
  const birth = dateOnly(birthDate);
  if (!birth || birth > today) return;
  const years = Number(today.slice(0, 4)) - Number(birth.slice(0, 4));
  return years - Number(today.slice(5) < birth.slice(5));
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase('pt-BR');
}

function complaintLabel(value?: string | null) {
  return value ? complaints[value as keyof typeof complaints] ?? value : '—';
}

function formatRg(value: string, limit = false) {
  let document = value.replace(/[.\s-]/g, '').toUpperCase();
  if (limit) {
    const characters = document.replace(/[^\dX]/g, '').replace(/^X+/, '');
    document = characters.match(/^\d+X?/)?.[0].slice(0, 9) ?? '';
  }
  if (!document) return '';
  if (!/^\d{1,9}X?$/.test(document) || document.length > 9) return value;
  const hasCheckDigit = document.length === 9 || document.endsWith('X') || /-\s*\d\s*$/.test(value);
  const number = hasCheckDigit ? document.slice(0, -1) : document;
  const grouped = number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return hasCheckDigit ? `${grouped}-${document.slice(-1)}` : grouped;
}

function formatContact(value: string, limit = false) {
  const compact = value.replace(/[()\s-]/g, '');
  if (compact === '+' || compact === '+5') return limit ? compact : value;
  if (!limit && !/^\d*$/.test(compact) && !/^\+55\d*$/.test(compact)) return value;
  const withCountry = compact.startsWith('+55') || (!limit && /^55\d{10,11}$/.test(compact));
  const national = withCountry ? compact.replace(/^\+?55/, '') : compact;
  const digits = limit ? national.replace(/\D/g, '').slice(0, 11) : national;
  const prefix = withCountry ? '+55' : '';
  if (digits.length <= 2) return prefix + digits;
  if (digits.length > 11) return value;
  const subscriber = digits.slice(2);
  const split = subscriber.length === 9 ? 5 : 4;
  const phone = subscriber.length > split ? `${subscriber.slice(0, split)}-${subscriber.slice(split)}` : subscriber;
  return `${prefix ? `${prefix} ` : ''}(${digits.slice(0, 2)}) ${phone}`;
}

function formatCep(value: string, limit = false) {
  const digits = limit ? value.replace(/\D/g, '').slice(0, 8) : value.replace(/[.\s-]/g, '');
  if (!/^\d{0,8}$/.test(digits)) return value;
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

const masks = { rg: formatRg, contato: formatContact, cep: formatCep };
type Mask = (value: string, limit?: boolean) => string;

function fieldValue(name: string, value: string, limit = false) {
  if (name === 'cpf') return value.replace(/\D/g, '');
  if (name === 'dataNascimento') return dateOnly(value);
  if (name === 'rg' || name === 'contato' || name === 'cep') return masks[name](value.trim(), limit);
  return value.trim();
}

function MaskedInput({ mask, defaultValue, ...props }: InputHTMLAttributes<HTMLInputElement> & { mask: Mask }) {
  const [value, setValue] = useState(() => mask(String(defaultValue ?? '')));

  function change(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const typed = input.value;
    const formatted = mask(typed, true);
    setValue(formatted);
    const caret = input.selectionStart ?? typed.length;
    if (typed === formatted || caret === typed.length) return;

    let remaining = typed.slice(0, caret).replace(/[^\dA-Za-z+]/g, '').length;
    let position = 0;
    while (remaining && position < formatted.length) {
      if (/[\dA-Za-z+]/.test(formatted[position++])) remaining--;
    }
    requestAnimationFrame(() => {
      if (document.activeElement === input && input.value === formatted) input.setSelectionRange(position, position);
    });
  }

  return <input {...props} value={value} onChange={change} />;
}

function Input({ label, name, mask, ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; name: string; mask?: Mask;
}) {
  return <label className="field">
    <span>{label}{props.required && <em aria-hidden="true"> *</em>}</span>
    {mask ? <MaskedInput name={name} mask={mask} {...props} /> : <input name={name} {...props} />}
  </label>;
}

function YesNo({ name, label, value, onChange }: {
  name: Question; label: string; value?: boolean; onChange: (answer: boolean) => void;
}) {
  return <fieldset className="beneficiary-question">
    <legend>{label}<em aria-hidden="true"> *</em></legend>
    <div className="beneficiary-choices">
      <label><input type="radio" name={name} value="sim" checked={value === true} onChange={() => onChange(true)} required /> Sim</label>
      <label><input type="radio" name={name} value="nao" checked={value === false} onChange={() => onChange(false)} required /> Não</label>
    </div>
  </fieldset>;
}

function BeneficiaryForm({ person, pending, error, onSave, onError, onCancel }: {
  person?: Beneficiario; pending: boolean; error: string;
  onSave: (body: object) => void; onError: (message: string) => void; onCancel: () => void;
}) {
  const [answers, setAnswers] = useState<Partial<Record<Question, boolean>>>(() => person ? {
    possuiIrmaos: person.possuiIrmaos, possuiDeficit: person.possuiDeficit,
    fazAcompanhamento: person.fazAcompanhamento, fazUsoMedicacao: person.fazUsoMedicacao,
  } : {});
  const [cpf, setCpf] = useState(formatCpf(person?.cpf ?? ''));
  const formError = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) formError.current?.scrollIntoView({ block: 'nearest' }); }, [error]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (name: string) => fieldValue(name, String(data.get(name) ?? ''));
    const body: Record<string, string | number | boolean | null> = {};

    for (const field of requiredFields) {
      const raw = String(data.get(field) ?? '');
      if (person && fieldValue(field, raw) === fieldValue(field, person[field] ?? '')) continue;
      const value = fieldValue(field, raw, true);
      if (field === 'cep' && !/^\d{5}-\d{3}$/.test(value)) return onError('Informe um CEP com 8 números.');
      body[field] = value;
    }
    for (const field of optionalFields) {
      const value = read(field);
      if (person ? value !== (person[field] ?? '').trim() : value) body[field] = value || null;
    }
    for (const [name, , details] of questions) {
      const value = answers[name];
      if (value === undefined) return onError('Responda às perguntas obrigatórias do cadastro.');
      if (!person || value !== person[name]) body[name] = value;
      if (!value) continue;
      for (const field of details) {
        const detail = read(field);
        const current = person?.[name] ? person[field] : undefined;
        if (!detail) return onError('Preencha os detalhes das respostas marcadas como Sim.');
        if (field === 'quantidadeIrmaos') {
          const count = Number(detail);
          if (count !== current) body[field] = count;
        } else if (detail !== current) {
          body[field] = detail;
        }
      }
    }

    if (!Object.keys(body).length) {
      onCancel();
      return;
    }
    onSave(body);
  }

  const question = (name: Question, label: string) => <YesNo name={name} label={label} value={answers[name]}
    onChange={(value) => setAnswers((previous) => ({ ...previous, [name]: value }))} />;

  return <WorkspaceDialog title={person ? 'Editar Cadastro' : 'Novo Cadastro de Paciente'} size="wide" pending={pending} onClose={onCancel}>
    <form className="workspace-dialog-form" onSubmit={submit}>
      <div className="workspace-dialog-content beneficiary-form">
        <fieldset className="beneficiary-form-section" disabled={pending}>
          <legend>Identificação</legend>
          <div className="beneficiary-fields">
            <Input name="numeroCadastro" label="Nº de Cadastro" defaultValue={person?.numeroCadastro} required data-initial-focus />
            <Input name="displayDataCadastro" label="Data de Cadastro" value={person ? displayDate(person.dataCadastro) : 'Gerada ao cadastrar'} readOnly />
            <Input name="dataNascimento" label="Data de nascimento" type="date" defaultValue={dateOnly(person?.dataNascimento ?? '')} required />
            <div className="beneficiary-span-full">
              <Input name="nomeBeneficiario" label="Nome do beneficiário" defaultValue={person?.nomeBeneficiario} required />
            </div>
            <Input name="rg" label="RG" placeholder="00.000.000-0" mask={masks.rg} defaultValue={person?.rg} required />
            <Input name="cpf" label="CPF" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))}
              inputMode="numeric" placeholder="000.000.000-00" required />
          </div>
        </fieldset>
        <fieldset className="beneficiary-form-section" disabled={pending}>
          <legend>Família e contato</legend>
          <div className="beneficiary-fields">
            <Input name="nomeMae" label="Nome da mãe" defaultValue={person?.nomeMae} required />
            <Input name="nomePai" label="Nome do pai" defaultValue={person?.nomePai ?? ''} />
            {question(questions[0][0], questions[0][1])}
            {answers.possuiIrmaos && <>
              <Input name="quantidadeIrmaos" label="Quantidade de irmãos" type="number" min={1} step={1}
                defaultValue={person?.quantidadeIrmaos ?? ''} required />
              <div className="beneficiary-span-two"><Input name="nomesIrmaos" label="Nomes dos irmãos" defaultValue={person?.nomesIrmaos ?? ''} required /></div>
            </>}
            <Input name="contato" label="Contato" type="tel" placeholder="(00) 00000-0000"
              mask={masks.contato} defaultValue={person?.contato} required />
            <Input name="email" label="E-mail" type="email" defaultValue={person?.email} required />
          </div>
        </fieldset>
        <fieldset className="beneficiary-form-section" disabled={pending}>
          <legend>Endereço</legend>
          <div className="beneficiary-fields">
            <div className="beneficiary-span-two"><Input name="endereco" label="Endereço" defaultValue={person?.endereco} required /></div>
            <Input name="numero" label="Número" defaultValue={person?.numero} required />
            <Input name="bairro" label="Bairro" defaultValue={person?.bairro} required />
            <Input name="cidade" label="Cidade" defaultValue={person?.cidade} required />
            <Input name="cep" label="CEP" inputMode="numeric" placeholder="00000-000" mask={masks.cep} defaultValue={person?.cep} required />
            <label className="field"><span>Estado<em aria-hidden="true"> *</em></span>
              <select name="estado" defaultValue={person?.estado ?? ''} required>
                <option value="">Selecione...</option>
                {person?.estado && !stateCodes.includes(person.estado) && <option>{person.estado}</option>}
                {stateCodes.map((code) => <option key={code}>{code}</option>)}
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset className="beneficiary-form-section" disabled={pending}>
          <legend>Escola</legend>
          <div className="beneficiary-fields">
            <Input name="escolaFrequenta" label="Escola que frequenta" defaultValue={person?.escolaFrequenta} required />
            <Input name="serie" label="Série" defaultValue={person?.serie} required />
            <Input name="acompanhanteEscolar" label="Quem acompanha as atividades escolares" defaultValue={person?.acompanhanteEscolar ?? ''} />
          </div>
        </fieldset>
        <fieldset className="beneficiary-form-section" disabled={pending}>
          <legend>Saúde e aprendizado</legend>
          <div className="beneficiary-health">
            {question(questions[1][0], questions[1][1])}
            {answers.possuiDeficit && <label className="field"><span>Queixa de aprendizado<em aria-hidden="true"> *</em></span>
              <select name="queixa" defaultValue={person?.queixa ?? ''} required>
                <option value="">Selecione...</option>
                {Object.entries(complaints).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>}
            {question(questions[2][0], questions[2][1])}
            {answers.fazAcompanhamento && <Input name="quaisAcompanhamentos" label="Quais acompanhamentos?" defaultValue={person?.quaisAcompanhamentos ?? ''} required />}
            {question(questions[3][0], questions[3][1])}
            {answers.fazUsoMedicacao && <Input name="quaisMedicacoes" label="Quais medicações?" defaultValue={person?.quaisMedicacoes ?? ''} required />}
          </div>
        </fieldset>
        {error && <p ref={formError} className="notice error" role="alert">{error}</p>}
      </div>
      <footer className="form-actions workspace-dialog-footer">
        <button type="button" className="back-button" disabled={pending} onClick={onCancel}>Cancelar</button>
        <button className="primary-button" disabled={pending}>
          {person ? (pending ? 'Salvando…' : 'Salvar') : (pending ? 'Cadastrando…' : 'Cadastrar')}
        </button>
      </footer>
    </form>
  </WorkspaceDialog>;
}

interface HistoryRecord {
  id: string;
  origem: 'registro' | 'atendimento';
  dataRealizacao: string;
  titulo: string;
  status: string | null;
  profissionalNome: string;
}

interface RecordDetail {
  tipo: string;
  dataRealizacao: string;
  titulo: string;
  descricao: string | null;
  avaliacoes: string | null;
  procedimentos: string | null;
  profissionalNome: string;
  profissionalArea: string;
  atendimento: { tipo: string; dataInicio: string; status: string } | null;
}

interface AppointmentDetail {
  tipo: string;
  dataInicio: string;
  dataFim: string;
  status: string;
  motivoCancelamento: string | null;
}

const recordTypes: Record<string, string> = {
  atendimento: 'Atendimento', avaliacao: 'Avaliação', procedimento: 'Procedimento', evolucao: 'Evolução',
};
const appointmentStatus: Record<string, string> = { agendado: 'Agendado', realizado: 'Realizado', cancelado: 'Cancelado' };
const clock = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', hour: '2-digit', minute: '2-digit' });

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);
}

// Atendimento agendado cujo horário já passou aparece como realizado (mesma regra do backend do histórico)
function appointmentStatusLabel(status: string, start: string) {
  const shown = status === 'agendado' && new Date(start).getTime() < Date.now() ? 'realizado' : status;
  return appointmentStatus[shown] ?? shown;
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

// RN37: detalhes de um item do prontuário (registro clínico ou atendimento da agenda)
function HistoryDetail({ token, onExpired, record }: DataAccess & { record: HistoryRecord }) {
  const [detail, setDetail] = useState<RecordDetail | AppointmentDetail>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const path = record.origem === 'registro' ? `/historico-clinico/registros/${record.id}` : `/atendimentos/${record.id}`;
    void api<RecordDetail | AppointmentDetail>(path, { token }).then((data) => {
      if (active) setDetail(data);
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'Não foi possível carregar os detalhes.');
    });
    return () => { active = false; };
  }, [token, onExpired, record.id, record.origem]);

  if (error) return <p className="notice error" role="alert">{error}</p>;
  if (!detail) return <p role="status">Carregando detalhes…</p>;

  if ('dataFim' in detail) {
    return <dl className="history-detail">
      <DetailItem label="Tipo" value={capitalize(detail.tipo)} />
      <DetailItem label="Data" value={`${displayDate(detail.dataInicio)}, ${clock.format(new Date(detail.dataInicio))}–${clock.format(new Date(detail.dataFim))}`} />
      <DetailItem label="Profissional" value={record.profissionalNome} />
      <DetailItem label="Status" value={appointmentStatusLabel(detail.status, detail.dataInicio)} />
      <DetailItem label="Motivo do cancelamento" value={detail.motivoCancelamento} />
    </dl>;
  }

  const area = areas[detail.profissionalArea as Area] ?? capitalize(detail.profissionalArea);
  return <dl className="history-detail">
    <DetailItem label="Tipo" value={recordTypes[detail.tipo] ?? detail.tipo} />
    <DetailItem label="Data" value={displayDate(detail.dataRealizacao)} />
    <DetailItem label="Profissional" value={`${detail.profissionalNome} · ${area}`} />
    <DetailItem label="Descrição" value={detail.descricao} />
    <DetailItem label="Avaliações" value={detail.avaliacoes} />
    <DetailItem label="Procedimentos" value={detail.procedimentos} />
    {detail.atendimento && <DetailItem label="Atendimento vinculado"
      value={`Atendimento de ${detail.atendimento.tipo} em ${displayDate(detail.atendimento.dataInicio)} (${appointmentStatusLabel(detail.atendimento.status, detail.atendimento.dataInicio)})`} />}
  </dl>;
}

function BeneficiaryHistory({ token, onExpired, person, onClose }: DataAccess & { person: Beneficiario; onClose: () => void }) {
  const [records, setRecords] = useState<HistoryRecord[]>();
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<HistoryRecord>();
  useEffect(() => {
    let active = true;
    void api<{ registros: HistoryRecord[] }>(`/historico-clinico/pacientes/${person.id}`, { token }).then(({ registros }) => {
      if (active) setRecords(registros);
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'Não foi possível carregar o prontuário.');
    });
    return () => { active = false; };
  }, [token, onExpired, person.id]);

  return <WorkspaceDialog title="Prontuário" onClose={onClose}>
    <div className="workspace-dialog-content beneficiary-history">
      <h3>{selected ? selected.titulo : person.nomeBeneficiario}</h3>
      {selected ? <HistoryDetail token={token} onExpired={onExpired} record={selected} />
        : error ? <p className="notice error" role="alert">{error}</p>
        : !records ? <p role="status">Carregando prontuário…</p>
        : !records.length ? <p>Nenhum registro no histórico clínico.</p>
        : <ul>{records.map((record) => <li key={`${record.origem}-${record.id}`}>
          <button type="button" className="history-item" onClick={() => setSelected(record)}
            aria-label={`Ver detalhes: ${record.titulo} em ${displayDate(record.dataRealizacao)}`}>
            <strong>{record.titulo}</strong>
            <span>{displayDate(record.dataRealizacao)} · {record.profissionalNome}
              {record.status && ` · ${appointmentStatus[record.status] ?? record.status}`}</span>
          </button>
        </li>)}</ul>}
    </div>
    <footer className="form-actions workspace-dialog-footer">
      {selected && <button type="button" className="back-button" onClick={() => setSelected(undefined)}>Voltar</button>}
      <button type="button" className="back-button" onClick={onClose}>Fechar</button>
    </footer>
  </WorkspaceDialog>;
}

// canRemove: só a coordenação exclui cadastros (excluir também tira o paciente da lista de espera)
export function Beneficiarios({ token, onExpired, onNotify, canRemove }: DataAccess & {
  onNotify: (notification: Notification) => void; canRemove: boolean;
}) {
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<Action>();
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState('');
  const newButton = useRef<HTMLButtonElement>(null);
  const { records, error, reload } = useRecords<Beneficiario>(endpoint, token, onExpired);

  const today = calendar.format(new Date());
  const search = normalize(query);
  const filtered = records?.filter((person) =>
    [person.nomeBeneficiario, person.numeroCadastro, String(person.id), person.queixa ?? '']
      .some((value) => normalize(value).includes(search)));

  function open(next: Action) {
    setSaveError('');
    setAction(next);
  }

  function close() {
    setAction(undefined);
  }

  async function save(body?: object) {
    if (!action || action.type === 'history' || pending) return;
    setPending(true);
    setSaveError('');
    try {
      if (action.type === 'create' && body) {
        await api(endpoint, { token, body });
        onNotify({ message: 'Paciente cadastrado com sucesso', tone: 'success' });
        setQuery('');
      } else if (action.type === 'edit' && body) {
        await api(`${endpoint}/${action.person.id}`, { token, body, method: 'PATCH' });
        onNotify({ message: 'Cadastro atualizado', tone: 'success' });
      } else if (action.type === 'remove') {
        await api<void>(`${endpoint}/${action.person.id}`, { token, method: 'DELETE' });
        onNotify({ message: 'Cadastro excluído', tone: 'danger' });
      }
      close();
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
  return <section className="beneficiaries">
    <PageHeader title="Beneficiários" description={count === undefined ? 'Cadastros de pacientes' :
      count === 1 ? '1 beneficiário cadastrado' : `${count} beneficiários cadastrados`}
      action={<button ref={newButton} className="primary-button" type="button" onClick={() => open({ type: 'create' })}>
        <Plus size={19} aria-hidden="true" /> Novo Cadastro
      </button>} />
    <div className="beneficiary-filters">
      <label className="field beneficiary-search"><span className="sr-only">Buscar beneficiários</span>
        <span className="search-field"><Search size={18} aria-hidden="true" />
          <input type="search" value={query} placeholder="Buscar por nome, ID ou queixa..." onChange={(event) => setQuery(event.target.value)} />
        </span>
      </label>
    </div>
    {error ? <div className="panel"><p className="notice error" role="alert">{error}</p>
      <button type="button" className="text-button" onClick={reload}>Tentar novamente</button></div>
      : !filtered ? <p className="team-message" role="status">Carregando beneficiários…</p>
      : !filtered.length ? <p className="team-message" role="status">Nenhum beneficiário encontrado.</p>
      : <div className="table-scroll beneficiary-table">
        <table aria-label="Beneficiários cadastrados">
          <thead><tr><th scope="col">ID</th><th scope="col">Paciente</th><th scope="col">Queixa de aprendizado</th>
            <th scope="col">Data de cadastro</th><th scope="col">Ações</th></tr></thead>
          <tbody>{filtered.map((person) => {
            const age = ageAt(person.dataNascimento, today);
            return <tr key={person.id}>
              <td className="beneficiary-id">{person.numeroCadastro}</td>
              <th scope="row">{person.nomeBeneficiario}{age !== undefined && <small>{age} {age === 1 ? 'ano' : 'anos'}</small>}</th>
              <td>{person.possuiDeficit ? complaintLabel(person.queixa) : '—'}</td>
              <td>{displayDate(person.dataCadastro) || '—'}</td>
              <td><div className="beneficiary-actions">
                <button type="button" className="text-button" onClick={() => open({ type: 'history', person })}>Ver Prontuário</button>
                <button type="button" className="icon-button" aria-label={`Editar cadastro de ${person.nomeBeneficiario}`}
                  onClick={() => open({ type: 'edit', person })}><Pencil size={18} aria-hidden="true" /></button>
                {canRemove && <button type="button" className="icon-button professional-remove" aria-label={`Excluir cadastro de ${person.nomeBeneficiario}`}
                  onClick={() => open({ type: 'remove', person })}><Trash2 size={18} aria-hidden="true" /></button>}
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    {canRemove && action?.type === 'remove' && <WorkspaceDialog title="Excluir cadastro" size="compact" pending={pending} onClose={close}>
      <div className="workspace-dialog-content workspace-remove-content">
        <p>Deseja excluir o cadastro de <strong>{action.person.nomeBeneficiario}</strong>? O cadastro será desativado.</p>
        {saveError && <p className="notice error" role="alert">{saveError}</p>}
      </div>
      <footer className="form-actions workspace-dialog-footer">
        <button type="button" className="back-button" data-initial-focus disabled={pending} onClick={close}>Cancelar</button>
        <button type="button" className="primary-button workspace-danger" disabled={pending} onClick={() => void save()}>
          {pending ? 'Excluindo…' : 'Excluir'}
        </button>
      </footer>
    </WorkspaceDialog>}
    {action?.type === 'history' && <BeneficiaryHistory token={token} onExpired={onExpired} person={action.person} onClose={close} />}
    {(action?.type === 'create' || action?.type === 'edit') && <BeneficiaryForm person={action.type === 'edit' ? action.person : undefined}
      pending={pending} error={saveError} onError={setSaveError} onSave={(body) => void save(body)} onCancel={close} />}
  </section>;
}

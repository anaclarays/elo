import { Plus, Search } from 'lucide-react';
import { useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { api, ApiError } from './api';
import { PageHeader, useRecords, type DataAccess } from './WorkspaceData';

export interface Beneficiario {
  id: number;
  nomeBeneficiario: string;
  numeroCadastro: string;
  contato: string;
}

function Input({ label, name, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <label className="field"><span>{label}{props.required && <em aria-hidden="true"> *</em>}</span>
    <input name={name} {...props} />
  </label>;
}

function BeneficiaryForm({ token, onExpired, onSaved, onCancel }: DataAccess & {
  onSaved: () => void; onCancel: () => void;
}) {
  const [siblings, setSiblings] = useState(false);
  const [learning, setLearning] = useState(false);
  const [assistance, setAssistance] = useState(false);
  const [medication, setMedication] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const fields = Object.fromEntries(Object.entries(data).map(([name, value]) => [name, String(value).trim()]));
    setPending(true);
    setError('');
    try {
      await api('/pacientes', { token, body: {
        ...fields,
        cpf: fields.cpf.replace(/\D/g, ''),
        estado: fields.estado.toUpperCase(),
        possuiIrmaos: siblings,
        possuiDeficit: learning,
        fazAcompanhamento: assistance,
        fazUsoMedicacao: medication,
        quantidadeIrmaos: siblings ? Number(fields.quantidadeIrmaos) : undefined,
      } });
      onSaved();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'Erro ao cadastrar beneficiário.');
    } finally {
      setPending(false);
    }
  }

  return <form className="panel beneficiary-form" onSubmit={submit}>
    <fieldset disabled={pending}>
      <legend>Dados pessoais</legend>
      <div className="form-grid">
        <Input name="nomeBeneficiario" label="Nome completo" autoFocus required />
        <Input name="numeroCadastro" label="Número do cadastro" required />
        <Input name="dataNascimento" label="Data de nascimento" type="date" required />
        <Input name="cpf" label="CPF" inputMode="numeric" maxLength={14} required />
        <Input name="rg" label="RG" required />
        <Input name="nomeMae" label="Nome da mãe" required />
        <Input name="nomePai" label="Nome do pai" />
      </div>
    </fieldset>
    <fieldset disabled={pending}>
      <legend>Endereço e contato</legend>
      <div className="form-grid">
        <Input name="endereco" label="Endereço" required />
        <Input name="numero" label="Número" required />
        <Input name="bairro" label="Bairro" required />
        <Input name="cidade" label="Cidade" required />
        <Input name="cep" label="CEP" inputMode="numeric" required />
        <Input name="estado" label="UF" minLength={2} maxLength={2} required />
        <Input name="contato" label="Telefone de contato" type="tel" required />
        <Input name="email" label="E-mail de contato" type="email" required />
      </div>
    </fieldset>
    <fieldset disabled={pending}>
      <legend>Informações escolares e de atendimento</legend>
      <div className="form-grid">
        <Input name="escolaFrequenta" label="Escola que frequenta" required />
        <Input name="serie" label="Série" required />
        <Input name="acompanhanteEscolar" label="Acompanhante escolar" />
      </div>
      <div className="conditional-fields">
        <label className="consent"><input type="checkbox" checked={siblings} onChange={(event) => setSiblings(event.target.checked)} /> Possui irmãos</label>
        {siblings && <div className="form-grid">
          <Input name="quantidadeIrmaos" label="Quantidade de irmãos" type="number" min={1} required />
          <Input name="nomesIrmaos" label="Nomes dos irmãos" required />
        </div>}
        <label className="consent"><input type="checkbox" checked={learning} onChange={(event) => setLearning(event.target.checked)} /> Possui déficit ou transtorno de aprendizagem</label>
        {learning && <label className="field"><span>Queixa de aprendizagem<em aria-hidden="true"> *</em></span>
          <select name="queixa" required><option value="">Selecione…</option><option value="motora">Motora</option><option value="leitura">Leitura</option><option value="escrita">Escrita</option><option value="lógica matemática">Lógica matemática</option></select>
        </label>}
        <label className="consent"><input type="checkbox" checked={assistance} onChange={(event) => setAssistance(event.target.checked)} /> Faz acompanhamento terapêutico</label>
        {assistance && <Input name="quaisAcompanhamentos" label="Quais acompanhamentos?" required />}
        <label className="consent"><input type="checkbox" checked={medication} onChange={(event) => setMedication(event.target.checked)} /> Faz uso de medicação</label>
        {medication && <Input name="quaisMedicacoes" label="Quais medicações?" required />}
      </div>
    </fieldset>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="form-actions">
      <button className="back-button" type="button" onClick={onCancel} disabled={pending}>Cancelar</button>
      <button className="primary-button" disabled={pending}>{pending ? 'Cadastrando…' : 'Cadastrar beneficiário'}</button>
    </div>
  </form>;
}

export function Beneficiarios({ token, onExpired }: DataAccess) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState(false);
  const { records, error, reload } = useRecords<Beneficiario>('/pacientes', token, onExpired);
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const filtered = records?.filter((person) => person.nomeBeneficiario.toLocaleLowerCase('pt-BR').includes(normalized)
    || person.numeroCadastro.includes(normalized));

  if (creating) return <>
    <PageHeader title="Cadastrar beneficiário" description="Preencha os dados do beneficiário." />
    <BeneficiaryForm token={token} onExpired={onExpired} onCancel={() => setCreating(false)} onSaved={() => {
      setCreating(false);
      setSaved(true);
      setQuery('');
      reload();
    }} />
  </>;

  return <>
    <PageHeader title="Beneficiários" description="Consulte e cadastre beneficiários."
      action={<button className="primary-button" type="button" onClick={() => { setSaved(false); setCreating(true); }}><Plus size={19} aria-hidden="true" /> Novo beneficiário</button>} />
    <section className="panel">
      {saved && <p className="notice success" role="status">Beneficiário cadastrado com sucesso.</p>}
      <label className="field filter-field"><span>Buscar beneficiário</span>
        <span className="search-field"><Search size={18} aria-hidden="true" /><input type="search" value={query}
          placeholder="Nome ou número de cadastro" onChange={(event) => setQuery(event.target.value)} /></span>
      </label>
      {error ? <><p className="notice error" role="alert">{error}</p><button type="button" className="text-button" onClick={reload}>Tentar novamente</button></>
        : !filtered ? <p role="status">Carregando beneficiários…</p>
        : !filtered.length ? <p role="status">Nenhum beneficiário encontrado.</p>
        : <div className="table-scroll"><table>
          <thead><tr><th scope="col">Nome</th><th scope="col">Número do cadastro</th><th scope="col">Telefone de contato</th></tr></thead>
          <tbody>{filtered.map((person) => <tr key={person.id}>
            <td>{person.nomeBeneficiario}</td><td>{person.numeroCadastro}</td><td>{person.contato}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  </>;
}

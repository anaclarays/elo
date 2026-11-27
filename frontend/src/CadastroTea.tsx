import { ArrowLeft, ArrowRight, ClipboardList, Users } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError, type Session } from './api';
import { Field, formatCpf } from './AuthPages';
import { teaEndpoint } from './PacientesTea';
import { PageHeader, useRecords, type DataAccess } from './WorkspaceData';
import { WorkspaceDialog } from './WorkspaceFeedback';

const categories = {
  crianca: 'Criança (até 11 anos)', adolescente: 'Adolescente (12 a 17 anos)',
  adulto: 'Adulto (18 a 59 anos)', idoso: 'Idoso (60 anos ou mais)',
};
const genders = { masculino: 'Masculino', feminino: 'Feminino', outros: 'Outros' };
const maritalStatuses = {
  solteiro: 'Solteiro(a)', casado: 'Casado(a)', uniao_estavel: 'União estável',
  separado: 'Separado(a)', divorciado: 'Divorciado(a)', viuvo: 'Viúvo(a)',
};
const therapies = {
  acompanhamento_psiquiatrico: 'Acompanhamento psiquiátrico',
  acompanhamento_neurologico: 'Acompanhamento neurológico',
  acompanhamento_psicologico: 'Acompanhamento psicológico',
  acompanhamento_neuropedagogico: 'Acompanhamento neuropedagógico',
  acompanhamento_fonoaudiologico: 'Acompanhamento fonoaudiológico',
  terapia_ocupacional: 'Terapia ocupacional', fisioterapia: 'Fisioterapia', outros: 'Outras terapias',
};
const states = 'AC AL AP AM BA CE DF ES GO MA MT MS PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Recife', dateStyle: 'short' });

interface ActiveProfessional {
  id: string;
  nome_completo: string;
}

export function EscolhaCadastro() {
  const [params] = useSearchParams();
  const type = params.get('tipo');
  const filter = type === 'tea' || type === 'aprendizagem' ? `tipo=${type}` : '';
  const back = filter ? `/beneficiarios?${filter}` : '/beneficiarios';
  const registration = (kind: 'beneficiario' | 'tea') => `/beneficiarios?${filter ? `${filter}&` : ''}cadastro=${kind}`;
  return <section className="registration-choice">
    <PageHeader title="Novo cadastro" description="Selecione o tipo de cadastro para continuar." />
    <div className="registration-options">
      <Link className="panel registration-option" to={registration('beneficiario')} replace>
        <span className="registration-icon"><Users size={23} aria-hidden="true" /></span>
        <div><h2>Beneficiário</h2><p>Cadastro de criança ou adolescente para acompanhamento de aprendizagem.</p></div>
        <ArrowRight size={19} aria-hidden="true" />
      </Link>
      <Link className="panel registration-option" to={registration('tea')} replace>
        <span className="registration-icon tea"><ClipboardList size={23} aria-hidden="true" /></span>
        <div><h2>Pessoa com TEA</h2><p>Cadastro e triagem para acompanhamento de pessoa com diagnóstico de TEA.</p></div>
        <ArrowRight size={19} aria-hidden="true" />
      </Link>
    </div>
    <Link className="back-button" to={back}><ArrowLeft size={17} aria-hidden="true" /> Voltar a Beneficiários</Link>
  </section>;
}

function SelectField({ label, id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string; id: string; children: ReactNode;
}) {
  return <label className="field"><span>{label}{props.required && <em aria-hidden="true"> *</em>}</span>
    <select id={id} name={id} {...props}>{children}</select>
  </label>;
}

function ChoiceField({ label, id, options, onChange }: {
  label: string; id: string; options: Record<string, string>; onChange?: (value: string) => void;
}) {
  return <SelectField label={label} id={id} defaultValue="" required onChange={(event) => onChange?.(event.target.value)}>
    <option value="" disabled>Selecione</option>
    {Object.entries(options).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
  </SelectField>;
}

function YesNo({ name, label, onChange, defaultValue }: {
  name: string; label: string; onChange?: (value: boolean) => void; defaultValue?: boolean;
}) {
  return <fieldset className="beneficiary-question">
    <legend>{label}<em aria-hidden="true"> *</em></legend>
    <div className="beneficiary-choices">
      <label><input type="radio" name={name} value="sim" defaultChecked={defaultValue === true} onChange={() => onChange?.(true)} required /> Sim</label>
      <label><input type="radio" name={name} value="nao" defaultChecked={defaultValue === false} onChange={() => onChange?.(false)} required /> Não</label>
    </div>
  </fieldset>;
}

function Notes({ name, label }: { name: string; label: string }) {
  return <label className="field beneficiary-span-full"><span>{label}</span><textarea name={name} rows={3} /></label>;
}

function CpfField({ id, label }: { id: string; label: string }) {
  return <Field id={id} label={label} inputMode="numeric" pattern="[0-9]{11}|[0-9]{3}[.][0-9]{3}[.][0-9]{3}-[0-9]{2}"
    title="Informe 11 dígitos" maxLength={14} onChange={(event) => {
      event.currentTarget.value = formatCpf(event.currentTarget.value);
    }} required />;
}

function registrationBody(data: FormData, professionalId: string) {
  const read = (key: string) => String(data.get(key) ?? '').trim();
  const optional = (key: string) => read(key) || undefined;
  const yes = (key: string) => read(key) === 'sim';
  const number = (key: string) => Number(read(key));
  const digits = (key: string) => read(key).replace(/\D/g, '');
  const categoria = read('categoria');
  const requiresGuardian = categoria === 'crianca' || categoria === 'adolescente';
  const frequentaEscola = yes('frequentaEscola');
  const parecerEspecialista = yes('parecerEspecialista');
  const realizaTerapias = yes('realizaTerapias');
  const terapias = realizaTerapias ? data.getAll('terapias').map(String) : [];
  const possuiFilhos = yes('possuiFilhos');
  const qtdMeninas = possuiFilhos ? number('qtdMeninas') : undefined;
  const qtdMeninos = possuiFilhos ? number('qtdMeninos') : undefined;
  if (realizaTerapias && !terapias.length) throw new Error('Selecione ao menos uma terapia.');
  if (possuiFilhos && !((qtdMeninas ?? 0) + (qtdMeninos ?? 0))) throw new Error('Informe a quantidade de filhos.');

  return {
    categoria,
    nomeCompleto: read('nomeCompleto'),
    dataNascimento: read('dataNascimento'),
    rgOuCertidao: read('rgOuCertidao'),
    cpf: digits('cpf'),
    genero: read('genero'),
    frequentaEscola,
    nomeInstituicao: frequentaEscola ? read('nomeInstituicao') : undefined,
    aguardaDiagnostico: yes('aguardaDiagnostico'),
    parecerEspecialista,
    parecerQuais: parecerEspecialista ? read('parecerQuais') : undefined,
    laudoMedico: yes('laudoMedico'),
    nivelSuporte: number('nivelSuporte'),
    outrosDiagnosticos: optional('outrosDiagnosticos'),
    realizaTerapias,
    terapias: realizaTerapias ? terapias : undefined,
    terapiaOutros: terapias.includes('outros') ? read('terapiaOutros') : undefined,
    medicacoes: optional('medicacoes'),
    alergias: optional('alergias'),
    ciptea: yes('ciptea'),
    bpc: yes('bpc'),
    numeroCartaoSus: optional('numeroCartaoSus'),
    observacoes: optional('observacoes'),
    responsavelTriagemId: optional('responsavelTriagemId') ?? professionalId,
    responsavelLegal: requiresGuardian ? {
      nome: read('responsavelNome'), rg: read('responsavelRg'),
      cpf: digits('responsavelCpf'), dataNascimento: read('responsavelDataNascimento'),
    } : undefined,
    dadosFamiliares: {
      estadoCivil: read('estadoCivil'), endereco: read('endereco'), numero: read('numero'),
      bairro: read('bairro'), cidade: read('cidade'), estado: read('estado'), contato: read('contato'),
      email: optional('email'), nomeConjuge: optional('nomeConjuge'), possuiFilhos, qtdMeninas, qtdMeninos,
      numPessoasCasa: number('numPessoasCasa'),
      rendaFamiliar: read('rendaFamiliar') ? number('rendaFamiliar') : undefined,
      recebeBolsaFamilia: data.has('recebeBolsaFamilia'),
      recebeOutroBeneficio: data.has('recebeOutroBeneficio'),
    },
  };
}

export function CadastroTea({ token, onExpired, person, onClose, onSaved }: DataAccess & {
  person: Session['profissional']; onClose: () => void; onSaved: (registrationNumber: number) => void;
}) {
  const [category, setCategory] = useState('');
  const [school, setSchool] = useState(false);
  const [specialist, setSpecialist] = useState(false);
  const [inTherapy, setInTherapy] = useState(false);
  const [otherTherapy, setOtherTherapy] = useState(false);
  const [hasChildren, setHasChildren] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const errorBox = useRef<HTMLParagraphElement>(null);
  const admin = person.areaAtuacao === 'coordenacao_administrativa';
  const team = useRecords<ActiveProfessional>(admin ? '/profissionais' : null, token, onExpired);
  const requiresGuardian = category === 'crianca' || category === 'adolescente';
  const today = calendar.format(new Date());

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      const body = registrationBody(data, person.id);
      const saved = await api<{ numero_cadastro: number }>(teaEndpoint, { token, body });
      onSaved(saved.numero_cadastro);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setPending(false);
    }
  }

  return <WorkspaceDialog title="Cadastro e triagem TEA" size="wide" pending={pending} onClose={onClose}>
    <form className="workspace-dialog-form" aria-busy={pending} onSubmit={(event) => void submit(event)}>
      <div className="workspace-dialog-content beneficiary-form tea-registration">
        <p className="registration-help">O número e a data do cadastro serão gerados ao salvar.</p>
        <fieldset className="tea-registration-fields" aria-label="Dados do cadastro TEA" disabled={pending}>
          <fieldset className="beneficiary-form-section">
            <legend>Dados da pessoa com TEA</legend>
            <div className="beneficiary-fields">
              <div className="beneficiary-span-full"><Field id="nomeCompleto" label="Nome completo" maxLength={255} required data-initial-focus /></div>
              <Field id="dataNascimento" label="Data de nascimento" type="date" max={today} required />
              <ChoiceField id="categoria" label="Faixa etária" options={categories} onChange={setCategory} />
              <ChoiceField id="genero" label="Gênero" options={genders} />
              <Field id="rgOuCertidao" label="RG ou certidão de nascimento" maxLength={50} required />
              <CpfField id="cpf" label="CPF" />
              <Field id="numeroCartaoSus" label="Nº do Cartão SUS" inputMode="numeric" pattern="[0-9]{15}" title="Informe 15 dígitos" maxLength={15} />
            </div>
          </fieldset>

          <fieldset className="beneficiary-form-section">
            <legend>Triagem e saúde</legend>
            <div className="beneficiary-fields">
              <div className="beneficiary-span-two">
                {admin ? <SelectField id="responsavelTriagemId" label="Responsável pela triagem" defaultValue={person.id} required>
                  <option value={person.id}>{person.nomeCompleto} (você)</option>
                  {team.records?.filter(({ id }) => id !== person.id).map(({ id, nome_completo }) => <option key={id} value={id}>{nome_completo}</option>)}
                </SelectField> : <Field id="triagemProfissional" label="Responsável pela triagem" value={person.nomeCompleto} readOnly />}
                {team.error && <p className="registration-help" role="status">Não foi possível carregar a equipe.{' '}
                  <button className="text-button" type="button" onClick={team.reload}>Tentar novamente</button>
                </p>}
              </div>
              <ChoiceField id="nivelSuporte" label="Nível de suporte" options={{ 1: 'Nível 1', 2: 'Nível 2', 3: 'Nível 3' }} />
              <YesNo name="aguardaDiagnostico" label="Aguarda diagnóstico?" defaultValue={false} />
              <YesNo name="laudoMedico" label="Possui laudo médico?" />
              <YesNo name="parecerEspecialista" label="Possui parecer de especialista?" onChange={setSpecialist} />
              {specialist && <div className="beneficiary-span-full"><Field id="parecerQuais" label="Quais pareceres?" required /></div>}
              <YesNo name="ciptea" label="Possui CIPTEA?" />
              <YesNo name="bpc" label="Recebe BPC?" />
              <YesNo name="frequentaEscola" label="Frequenta escola?" onChange={setSchool} />
              {school && <div className="beneficiary-span-full"><Field id="nomeInstituicao" label="Nome da instituição" maxLength={255} required /></div>}
              <Notes name="outrosDiagnosticos" label="Outros diagnósticos ou comorbidades" />
              <div className="beneficiary-span-full"><YesNo name="realizaTerapias" label="Realiza terapias?" onChange={(value) => {
                setInTherapy(value);
                if (!value) setOtherTherapy(false);
              }} /></div>
              {inTherapy && <fieldset className="beneficiary-question registration-therapies beneficiary-span-full">
                <legend>Terapias realizadas<em aria-hidden="true"> *</em></legend>
                {Object.entries(therapies).map(([value, label]) => <label key={value}>
                  <input type="checkbox" name="terapias" value={value} onChange={value === 'outros' ? (event) => setOtherTherapy(event.target.checked) : undefined} /> {label}
                </label>)}
              </fieldset>}
              {inTherapy && otherTherapy && <div className="beneficiary-span-full"><Field id="terapiaOutros" label="Quais outras terapias?" maxLength={255} required /></div>}
              <Field id="medicacoes" label="Medicações" />
              <Field id="alergias" label="Alergias" />
              <Notes name="observacoes" label="Observações" />
            </div>
          </fieldset>

          {requiresGuardian && <fieldset className="beneficiary-form-section">
            <legend>Responsável legal</legend>
            <div className="beneficiary-fields">
              <div className="beneficiary-span-full"><Field id="responsavelNome" label="Nome completo do responsável legal" maxLength={255} required /></div>
              <Field id="responsavelRg" label="RG do responsável legal" maxLength={50} required />
              <CpfField id="responsavelCpf" label="CPF do responsável legal" />
              <Field id="responsavelDataNascimento" label="Data de nascimento do responsável legal" type="date" max={today} required />
            </div>
          </fieldset>}

          <fieldset className="beneficiary-form-section">
            <legend>{requiresGuardian ? 'Dados familiares do responsável legal' : 'Dados familiares e socioeconômicos'}</legend>
            <div className="beneficiary-fields">
              <ChoiceField id="estadoCivil" label="Estado civil" options={maritalStatuses} />
              <div className="beneficiary-span-two"><Field id="nomeConjuge" label="Nome do cônjuge" maxLength={255} /></div>
              <div className="beneficiary-span-two"><Field id="endereco" label="Endereço" maxLength={255} required /></div>
              <Field id="numero" label="Número" maxLength={20} required />
              <Field id="bairro" label="Bairro" maxLength={100} required />
              <Field id="cidade" label="Cidade" maxLength={100} required />
              <SelectField id="estado" label="UF" defaultValue="" required>
                <option value="" disabled>Selecione</option>
                {states.map((state) => <option key={state}>{state}</option>)}
              </SelectField>
              <Field id="contato" label="Contato" type="tel" maxLength={20} required />
              <div className="beneficiary-span-two"><Field id="email" label="E-mail" type="email" maxLength={255} /></div>
              <YesNo name="possuiFilhos" label="Possui filhos?" onChange={setHasChildren} />
              {hasChildren && <>
                <Field id="qtdMeninas" label="Quantidade de meninas" type="number" min={0} step={1} />
                <Field id="qtdMeninos" label="Quantidade de meninos" type="number" min={0} step={1} />
              </>}
              <Field id="numPessoasCasa" label="Pessoas que moram na casa" type="number" min={1} step={1} required />
              <Field id="rendaFamiliar" label="Renda familiar (R$)" type="number" min={0} max={9999999999.99} step={0.01} />
              <fieldset className="beneficiary-question registration-therapies beneficiary-span-full">
                <legend>Benefícios familiares</legend>
                <label><input type="checkbox" name="recebeBolsaFamilia" /> Bolsa Família</label>
                <label><input type="checkbox" name="recebeOutroBeneficio" /> Outro benefício</label>
              </fieldset>
            </div>
          </fieldset>
        </fieldset>
        {error && <p className="notice error" role="alert" tabIndex={-1} ref={errorBox}>{error}</p>}
      </div>
      <footer className="form-actions workspace-dialog-footer">
        <button className="back-button" type="button" onClick={onClose} disabled={pending}>Cancelar</button>
        <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Salvar cadastro'}</button>
      </footer>
    </form>
  </WorkspaceDialog>;
}

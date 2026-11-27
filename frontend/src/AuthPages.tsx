import { ArrowLeft, Check, Circle, Eye, EyeOff, Mail } from 'lucide-react';
import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, areas, type Area, type Session } from './api';

export const passwordRules = [
  ['Mínimo de 8 caracteres', (value: string) => Array.from(value).length >= 8],
  ['Uma letra maiúscula', (value: string) => /[A-Z]/.test(value)],
  ['Uma letra minúscula', (value: string) => /[a-z]/.test(value)],
  ['Um número', (value: string) => /\d/.test(value)],
  ['Um caractere especial', (value: string) => /[^A-Za-z0-9]/.test(value)],
] as const;

export function Field({ label, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return <label className="field" htmlFor={id}>
    <span>{label}{props.required && <em aria-hidden="true"> *</em>}</span>
    <input id={id} name={id} {...props} />
  </label>;
}

export function PasswordField({ id, label, autoComplete, value, onValue, describedBy }: {
  id: string; label: string; autoComplete: string; value: string;
  onValue: (value: string) => void; describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return <div className="field">
    <label htmlFor={id}>{label}<em aria-hidden="true"> *</em></label>
    <div className="password-input">
      <input id={id} name={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete}
        required value={value} aria-describedby={describedBy} onChange={(event) => onValue(event.target.value)} />
      <button type="button" className="icon-button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-controls={id} onClick={() => setVisible(!visible)}><Icon size={18} /></button>
    </div>
  </div>;
}

export function PasswordChecklist({ password }: { password: string }) {
  return <ul className="password-checklist" id="password-rules">
    {passwordRules.map(([label, test]) => {
      const valid = test(password);
      const Icon = valid ? Check : Circle;
      return <li key={label} className={valid ? 'met' : undefined}>
        <Icon size={13} aria-hidden="true" />{label}<span className="sr-only">{valid ? ', atendido' : ', pendente'}</span>
      </li>;
    })}
  </ul>;
}

function AuthLayout({ title, description, children, back = '/login', tall = false }: {
  title: string; description: string; children: ReactNode; back?: string; tall?: boolean;
}) {
  return <main className={`auth-page${tall ? ' auth-page-tall' : ''}`}>
    <div className="auth-stack">
      <Link to={back} className="back-button"><ArrowLeft size={17} aria-hidden="true" /> Voltar</Link>
      <img className="auth-logo" src="/logo-palavra-em-acao.png" alt="Palavra em Ação" width="145" height="106" />
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-heading">
          <h1 id="auth-title">{title}</h1>
          <p>{description}</p>
        </header>
        {children}
      </section>
    </div>
  </main>;
}

function useSubmit() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.');
    } finally {
      setPending(false);
    }
  }
  return { pending, error, submit };
}

function Feedback({ error }: { error: string }) {
  return error && <p className="notice error" role="alert">{error}</p>;
}

export function Welcome() {
  return <main className="auth-page">
    <div className="auth-stack">
      <img className="auth-logo" src="/logo-palavra-em-acao.png" alt="Palavra em Ação" />
      <section className="auth-card">
        <header className="auth-heading"><h1>Módulo de Gestão</h1><p>Palavra em Ação · AESA</p></header>
        <Link to="/login" className="primary-button">Entrar</Link>
        <p className="auth-footer"><Link to="/cadastro">Criar conta</Link></p>
      </section>
    </div>
  </main>;
}

export function Login({ onSession }: { onSession: (session: Session) => void }) {
  const [password, setPassword] = useState('');
  const { pending, error, submit } = useSubmit();
  const location = useLocation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void submit(async () => {
      const session = await api<Session>('/auth/login', { body: { email: String(data.get('email')).trim(), senha: password } });
      onSession(session);
    });
  }

  return <AuthLayout title="Entrar" description="Acesse o módulo de gestão com sua conta." back="/inicio">
    <form onSubmit={handleSubmit} className="auth-form">
      {location.state?.message && <p className="notice success" role="status">{location.state.message}</p>}
      <Field id="email" label="E-mail" type="email" autoComplete="username" placeholder="seu@email.com" required />
      <PasswordField id="senha" label="Senha" autoComplete="current-password" value={password} onValue={setPassword} />
      <Link className="forgot-link" to="/recuperar-senha">Esqueci minha senha</Link>
      <Feedback error={error} />
      <button className="primary-button" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</button>
    </form>
    <p className="auth-footer">Não tem conta? <Link to="/cadastro">Criar conta</Link></p>
  </AuthLayout>;
}

export function Recovery() {
  const { pending, error, submit } = useSubmit();
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    void submit(async () => {
      await api('/auth/recuperacao-senha', { body: { email } });
      setSent(true);
    });
  }

  return <AuthLayout title="Recuperar senha" description="Informe seu e-mail para receber o link de recuperação.">
    {sent ? <div className="notice success" role="status">
      <Mail size={20} aria-hidden="true" />
      <span>Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Confira também a caixa de spam.</span>
    </div> : <form onSubmit={handleSubmit} className="auth-form">
      <Field id="email" label="E-mail" type="email" autoComplete="email" placeholder="seu@email.com" required />
      <Feedback error={error} />
      <button className="primary-button" disabled={pending}>{pending ? 'Enviando…' : 'Enviar link de recuperação'}</button>
    </form>}
    <p className="auth-footer"><Link to="/login">Voltar para login</Link></p>
  </AuthLayout>;
}

function checkPassword(password: string, confirmation: FormDataEntryValue | null) {
  if (!passwordRules.every(([, test]) => test(password))) throw new Error('Sua senha precisa atender a todos os requisitos.');
  if (new TextEncoder().encode(password).length > 72) throw new Error('Use uma senha de até 72 bytes.');
  if (password !== confirmation) throw new Error('As senhas informadas precisam ser iguais.');
}

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const { pending, error, submit } = useSubmit();
  const navigate = useNavigate();
  const token = new URLSearchParams(useLocation().search).get('token');
  if (!token) return <Navigate to="/recuperar-senha" replace />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(async () => {
      checkPassword(password, confirmation);
      await api('/auth/redefinir-senha', { body: { token, senha: password } });
      navigate('/login', { replace: true, state: { message: 'Senha redefinida. Entre com a sua nova senha.' } });
    });
  }

  return <AuthLayout title="Redefinir senha" description="Crie uma nova senha para acessar sua conta." back="/recuperar-senha">
    <form onSubmit={handleSubmit} className="auth-form">
      <PasswordField id="nova-senha" label="Nova senha" autoComplete="new-password" value={password} onValue={setPassword} describedBy="password-rules" />
      <PasswordChecklist password={password} />
      <PasswordField id="confirmar-senha" label="Confirmar senha" autoComplete="new-password" value={confirmation} onValue={setConfirmation} />
      <Feedback error={error} />
      <button className="primary-button" disabled={pending}>{pending ? 'Salvando…' : 'Salvar nova senha'}</button>
    </form>
    <p className="auth-footer"><Link to="/recuperar-senha">Solicitar outro link</Link></p>
  </AuthLayout>;
}

export function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4')
    .replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3')
    .replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
}

export function Register({ onSession }: { onSession: (session: Session) => void }) {
  const [cpf, setCpf] = useState('');
  const [area, setArea] = useState<Area | ''>('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const { pending, error, submit } = useSubmit();
  const admin = area === 'coordenacao_administrativa';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? '').trim() || undefined;
    const capacity = read('capacidadeSemanal');
    const period = read('periodo');
    const start = read('horarioInicio');
    const end = read('horarioFim');
    void submit(async () => {
      checkPassword(password, confirmation);
      if (start && end && start >= end) throw new Error('A hora de fim deve ser posterior à hora de início.');
      const session = await api<Session>('/auth/cadastro', { body: {
        nomeCompleto: read('nomeCompleto'), cpf: cpf.replace(/\D/g, ''), email: read('email'),
        cargo: read('cargo'), areaAtuacao: area, senha: password, consentimentoLgpd: data.has('consentimento'),
        ...(!admin && {
          telefone: read('telefone'), capacidadeSemanal: capacity === undefined ? undefined : Number(capacity),
          periodos: period ? [period] : undefined, horarioInicio: start, horarioFim: end, status: read('status'),
        }),
      } });
      onSession(session);
    });
  }

  return <AuthLayout title="Criar conta" description="Preencha seus dados para acessar o módulo de gestão." tall>
    <form onSubmit={handleSubmit} className="auth-form">
      <Field id="nomeCompleto" label="Nome completo" autoComplete="name" required />
      <Field id="cpf" label="CPF" inputMode="numeric" placeholder="000.000.000-00" value={cpf}
        minLength={14} onChange={(event) => setCpf(formatCpf(event.target.value))} required />
      <Field id="email" label="E-mail" type="email" autoComplete="email" required />
      <div className="form-grid area-row">
        <label className="field"><span>Área de atuação<em aria-hidden="true"> *</em></span>
          <select name="areaAtuacao" value={area} onChange={(event) => setArea(event.target.value as Area | '')} required>
            <option value="">Selecione…</option>
            {Object.entries(areas).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <Field id="cargo" label="Cargo" autoComplete="organization-title" />
      </div>
      {area && !admin && <fieldset className="volunteer-fields">
        <legend>Dados do voluntariado <span>(opcionais)</span></legend>
        <div className="form-grid">
          <Field id="telefone" label="Telefone" type="tel" autoComplete="tel" placeholder="(00) 00000-0000" />
          <Field id="capacidadeSemanal" label="Capacidade semanal" type="number" min="0" max="2147483647" step="1" />
          <label className="field"><span>Período de atendimento</span>
            <select name="periodo"><option value="">Selecione…</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option></select>
          </label>
          <label className="field"><span>Status</span>
            <select name="status"><option value="">Selecione…</option><option value="Ativo">Ativo</option><option value="Inativo">Inativo</option></select>
          </label>
          <Field id="horarioInicio" label="Hora de início" type="time" />
          <Field id="horarioFim" label="Hora de fim" type="time" />
        </div>
      </fieldset>}
      <PasswordField id="senha" label="Senha" autoComplete="new-password" value={password} onValue={setPassword} describedBy="password-rules" />
      <PasswordChecklist password={password} />
      <PasswordField id="confirmar-senha" label="Confirmar senha" autoComplete="new-password" value={confirmation} onValue={setConfirmation} />
      <label className="consent"><input type="checkbox" name="consentimento" required />
        <span>Autorizo o tratamento dos meus dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD).<em aria-hidden="true"> *</em></span>
      </label>
      <Feedback error={error} />
      <button className="primary-button" disabled={pending}>{pending ? 'Criando conta…' : 'Criar conta'}</button>
    </form>
    <p className="auth-footer">Já tem conta? <Link to="/login">Entrar</Link></p>
  </AuthLayout>;
}

# ELO — Sistema de Gestão Inteligente Integrada

> Sistema desenvolvido como projeto da disciplina de Integração e Evolução de Sistemas de Informação (IESI), com foco no cadastro e acompanhamento de beneficiários, no gerenciamento de agendamentos e no apoio à gestão de disponibilidade de profissionais.

**Status:** Projeto concluído.

---

## Sobre o projeto

O **ELO** é um sistema desenvolvido para apoiar a ONG Palavra em Ação no cadastro e acompanhamento dos beneficiários e no gerenciamento de agendamentos e atividades, centralizando informações, facilitando o acompanhamento da agenda e oferecendo recursos para auxiliar na organização e tomada de decisões.

O projeto foi desenvolvido durante a disciplina de Integração e Evolução de Sistemas de Informação e contempla o levantamento e especificação de requisitos, definição da arquitetura, planejamento, implementação, testes e documentação, aplicando práticas de Engenharia de Software ao longo do ciclo de desenvolvimento.

## Funcionalidades

O sistema contempla funcionalidades voltadas à gestão operacional e ao acompanhamento gerencial, incluindo:

- **Beneficiários:** cadastro de pacientes, incluindo pacientes com TEA, e prontuário com o histórico de atendimentos e registros clínicos.
- **Gerenciamento de agendamentos:** organização e acompanhamento dos agendamentos.
- **Gerenciamento de profissionais (Equipe):** controle das informações e disponibilidade dos profissionais.
- **Lista de espera:** acompanhamento de demandas que aguardam disponibilidade.
- **Acompanhamento de atividades:** visualização e acompanhamento das atividades realizadas.
- **Relatórios gerenciais:** disponibilização de informações para apoiar o acompanhamento e a gestão.
- **Indicadores e análises comparativas:** acompanhamento de dados e comparação de atividades.
- **Inteligência para gestão de disponibilidade:** sugestões de melhorias relacionadas à sobrecarga e à disponibilidade de agendamentos, considerando os profissionais disponíveis e suas agendas. Veja como funciona em [docs/architecture/sugestoes-ia.md](docs/architecture/sugestoes-ia.md) e a decisão na [ADR 008](docs/adr/008-sugestoes-ia.md).
- **Acesso e perfil:** login, recuperação de senha por e-mail e edição do próprio perfil.

> As funcionalidades devem ser consultadas conforme os módulos e permissões disponibilizados na versão final do sistema. O módulo mobile, voltado às famílias, está previsto para uma etapa futura e não faz parte desta versão.

---

## Tecnologias utilizadas

### Backend

- [Node.js](https://nodejs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [NestJS](https://nestjs.com/)
- [node-postgres (`pg`)](https://node-postgres.com/) — acesso ao banco de dados, com consultas SQL
- [PostgreSQL](https://www.postgresql.org/)
- [JWT](https://jwt.io/) — autenticação
- Jest — testes automatizados
- oxlint — análise estática do código (lint)

### Frontend Web

- React
- TypeScript
- Vite
- React Router

### Banco de dados

- PostgreSQL
- [Neon](https://neon.tech/) — hospedagem do banco de dados

### Ferramentas de desenvolvimento

- Git e GitHub — versionamento e colaboração
- Postman — testes e validação de endpoints
- Jest — testes automatizados do backend
- Notion — organização e documentação do projeto

---

## Estrutura do repositório

```text
elo/
├── .github/                  # Templates de issues e de pull requests
│
├── backend/
│   ├── src/                  # Código-fonte do backend
│   ├── test/                 # Testes automatizados
│   ├── .env.example          # Exemplo de configuração do ambiente
│   ├── .gitignore
│   ├── .prettierrc
│   ├── jest.config.ts        # Configuração do Jest
│   ├── nest-cli.json         # Configuração do NestJS
│   ├── oxlint.json           # Configuração do lint (oxlint)
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   └── tsconfig.build.json
│
├── docs/                     # Documentação do projeto
│   ├── adr/                  # Registros de decisões de arquitetura (ADRs)
│   └── architecture/         # Diagrama C4 e documentação técnica
│
├── frontend/
│   ├── public/               # Arquivos estáticos públicos
│   ├── src/                  # Código-fonte do frontend
│   ├── .gitignore
│   ├── index.html            # Página HTML principal
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   └── vite.config.js        # Configuração do Vite
│
├── CONTRIBUTORS.md
├── LICENSE
└── README.md
```

As pastas `node_modules/` e `dist/` são geradas ao instalar as dependências e compilar o projeto, e não são versionadas.

---

## Executando o projeto localmente

### Pré-requisitos

Antes de executar o projeto, é necessário ter instalado:

- [Node.js](https://nodejs.org/) — versão 24 ou superior
- npm — instalado junto com o Node.js
- [Git](https://git-scm.com/)
- Acesso às credenciais do banco de dados PostgreSQL utilizado pelo projeto

Para verificar as instalações:

```bash
node -v
npm -v
git --version
```

### 1. Clonando o repositório

Clone o repositório e acesse a pasta do projeto:

```bash
git clone https://github.com/anaclarays/elo.git
cd elo
```

### 2. Configurando o banco de dados

O banco de dados do ELO utiliza PostgreSQL hospedado no Neon. Não é necessário instalar ou executar o PostgreSQL localmente.

Para configurar a conexão:

1. Acesse o documento com as credenciais do banco, que fica no Drive do projeto, na pasta `Banco de dados`.
2. Copie as strings de conexão necessárias:
   - `DATABASE_URL` — conexão com pooling;
   - `DIRECT_URL` — conexão direta, sem pooling.
3. Acesse a pasta do backend:

```bash
cd backend
```

4. Copie o arquivo de exemplo das variáveis de ambiente:

```bash
cp .env.example .env
```

No Windows PowerShell, caso o comando anterior não funcione:

```powershell
Copy-Item .env.example .env
```

5. Preencha o arquivo `.env` com as configurações necessárias.

Exemplo:

```env
DATABASE_URL="sua-string-de-conexao-com-pooling"
DIRECT_URL="sua-string-de-conexao-direta"
JWT_SECRET="uma-chave-secreta-com-pelo-menos-32-caracteres"
PASSWORD_RESET_URL="http://localhost:5173/redefinir-senha"
```

Para enviar os e-mails de recuperação de senha, preencha também as variáveis `SMTP_*`. Consulte o arquivo `.env.example` para verificar todas as variáveis disponíveis.

**Importante:** nunca compartilhe o arquivo `.env` ou envie credenciais para o repositório. Ele contém informações sensíveis e já está no `.gitignore` do projeto.

### 3. Executando o backend

Todos os comandos desta seção devem ser executados dentro da pasta `backend/`.

#### Instalando as dependências

```bash
npm ci
```

O comando `npm ci` instala as dependências de acordo com as versões registradas no `package-lock.json`, garantindo maior consistência entre os ambientes de desenvolvimento. Execute-o novamente sempre que fizer `git pull` e o `package-lock.json` tiver mudado.

#### Executando em desenvolvimento

```bash
npm run start:dev
```

O backend estará disponível localmente em:

[http://localhost:3000](http://localhost:3000)

Se a conexão com o banco estiver funcionando, esta linha aparece no terminal:

```text
Conexão com o PostgreSQL (Neon) estabelecida: { now: ... }
```

Caso a aplicação apresente erros de conexão com o banco de dados, verifique:

- Se o arquivo `.env` foi criado corretamente;
- Se `DATABASE_URL` e `DIRECT_URL` estão preenchidas;
- Se as credenciais estão válidas;
- Se os comandos estão sendo executados dentro de `backend/`.

### 4. Executando o frontend web

Com o backend em execução, abra um novo terminal na raiz do repositório.

Acesse a pasta do frontend:

```bash
cd frontend
```

Instale as dependências:

```bash
npm ci
```

Execute o ambiente de desenvolvimento:

```bash
npm run dev
```

O frontend estará disponível em:

[http://localhost:5173](http://localhost:5173)

Durante o desenvolvimento local, as chamadas feitas para `/api` são encaminhadas ao backend na porta 3000.

#### Compilando o frontend

Para gerar a versão de produção do frontend:

```bash
npm run build
```

O comando verifica os tipos com o TypeScript e gera os arquivos na pasta `dist/`.

### 5. Executando os testes

#### Backend

Os testes automatizados do backend devem ser executados dentro da pasta `backend/`:

```bash
npm test
```

Utilize o script `npm test` disponibilizado no projeto, em vez de executar diretamente `npx jest`, pois o script passa a flag `--experimental-vm-modules` para o Node.js; sem ela, as suítes de testes falham antes de rodar.

#### Frontend

O frontend não possui testes automatizados. A verificação de tipos do TypeScript é executada no `npm run build`.

### 6. Adicionando ou atualizando dependências

Para adicionar uma nova dependência, acesse a pasta correspondente (`backend/` ou `frontend/`) e execute:

```bash
npm install <pacote>
```

Após adicionar ou atualizar dependências, os arquivos `package.json` e `package-lock.json` devem ser versionados juntos.

Para instalar as dependências de um projeto já configurado, prefira `npm ci`.

---

## Variáveis de ambiente

As variáveis de ambiente utilizadas pela aplicação são definidas nos arquivos `.env`, que não devem ser versionados.

Entre as configurações relevantes estão:

| Variável | Onde | Descrição |
|---|---|---|
| `DATABASE_URL` | Backend | String de conexão PostgreSQL com pooling |
| `DIRECT_URL` | Backend | String de conexão PostgreSQL direta |
| `JWT_SECRET` | Backend | Chave utilizada na autenticação JWT (pelo menos 32 caracteres) |
| `SMTP_*` | Backend | Configurações de envio de e-mails |
| `PASSWORD_RESET_URL` | Backend | URL da tela de redefinição de senha (local: `http://localhost:5173/redefinir-senha`) |
| `WEB_ORIGIN` | Backend | Origem do frontend autorizada a chamar a API quando ela é hospedada separadamente |
| `VITE_API_URL` | Frontend | URL da API, usada quando ela é hospedada separadamente |

Consulte o arquivo `.env.example` do backend para verificar os nomes, valores esperados e configurações adicionais. A variável `VITE_API_URL` é do frontend e só é necessária fora do ambiente local.

### Hospedando o frontend e a API separadamente

- Defina `VITE_API_URL` com a URL da API **antes** de compilar o frontend.
- No backend, defina `WEB_ORIGIN` com a origem do frontend.
- Configure a hospedagem do frontend para servir o `index.html` em todas as rotas da aplicação.
- Use o endereço HTTPS do frontend em `PASSWORD_RESET_URL`.

---

## Informações acadêmicas

| Informação | Detalhes |
|---|---|
| Projeto | ELO |
| Disciplina | Integração e Evolução de Sistemas de Informação (IESI) |
| Instituição | Centro de Informática — Universidade Federal de Pernambuco |
| Período | 2026.2 |
| Status | Concluído |

---

<p align="center">
  Desenvolvido como projeto acadêmico de IESI — CIn/UFPE.
</p>

# ELO — Sistema de Gestão de Agendamentos

> Sistema desenvolvido como projeto da disciplina de Integração e Evolução de Sistemas de Informação (IESI), com foco no gerenciamento de agendamentos, acompanhamento de atividades e apoio à gestão de disponibilidade de profissionais.

**Status:** Projeto concluído.

---

## Sobre o projeto

O **ELO** é um sistema desenvolvido para apoiar o gerenciamento de agendamentos e atividades, centralizando informações, facilitando o acompanhamento da agenda e oferecendo recursos para auxiliar na organização e tomada de decisões da ONG Palavra em Ação.

O projeto foi desenvolvido durante a disciplina de Integração e Evolução de Sistemas de Informação e contempla o levantamento e especificação de requisitos, definição da arquitetura, planejamento, implementação, testes e documentação, aplicando práticas de Engenharia de Software ao longo do ciclo de desenvolvimento.

## Funcionalidades

O sistema contempla funcionalidades voltadas à gestão operacional e ao acompanhamento gerencial, incluindo:

- **Gerenciamento de agendamentos:** organização e acompanhamento dos agendamentos.
- **Gerenciamento de profissionais:** controle das informações e disponibilidade dos profissionais.
- **Lista de espera:** acompanhamento de demandas que aguardam disponibilidade.
- **Acompanhamento de atividades:** visualização e acompanhamento das atividades realizadas.
- **Relatórios gerenciais:** disponibilização de informações para apoiar o acompanhamento e a gestão.
- **Indicadores e análises comparativas:** acompanhamento de dados e comparação de atividades.
- **Inteligência para gestão de disponibilidade:** sugestões de melhorias relacionadas à sobrecarga e à disponibilidade de agendamentos, considerando os profissionais disponíveis e suas agendas.
- **Aplicação mobile:** acesso às funcionalidades previstas para o módulo mobile.

> As funcionalidades devem ser consultadas conforme os módulos e permissões disponibilizados na versão final do sistema.

---

## Tecnologias utilizadas

### Backend

- [Node.js](https://nodejs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [NestJS](https://nestjs.com/)
- [Prisma ORM](https://www.prisma.io/)
- [PostgreSQL](https://www.postgresql.org/)
- [JWT](https://jwt.io/) — autenticação
- Jest — testes automatizados

### Frontend Web

- React
- TypeScript
- Vite

### Banco de dados

- PostgreSQL
- [Neon](https://neon.tech/) — hospedagem do banco de dados

### Ferramentas de desenvolvimento

- Git e GitHub — versionamento e colaboração
- Postman — testes e validação de endpoints
- Vitest/Jest — testes automatizados, conforme os módulos
- Notion — organização e documentação do projeto

---

## Estrutura do repositório

```text
## Estrutura do repositório

```text
elo/
├── backend/
│   ├── dist/                 # Arquivos gerados na compilação
│   ├── node_modules/         # Dependências instaladas
│   ├── src/                  # Código-fonte do backend
│   ├── test/                 # Testes automatizados
│   ├── .env.example          # Exemplo de configuração do ambiente
│   ├── .gitignore
│   ├── .prettierrc
│   ├── jest.config.ts        # Configuração do Jest
│   ├── nest-cli.json        # Configuração do NestJS
│   ├── eslint.config.mjs    # Configuração do ESLint
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   └── tsconfig.build.tsbuildinfo
│
├── docs/                     # Documentação do projeto
│
├── frontend/
│   ├── node_modules/         # Dependências instaladas
│   ├── public/              # Arquivos estáticos públicos
│   ├── src/                  # Código-fonte do frontend
│   ├── .gitignore
│   ├── index.html            # Página HTML principal
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   └── vite.config.js        # Configuração do Vite
│
└── README.md
```

---

# Executando o projeto localmente

## Pré-requisitos

Antes de executar o projeto, é necessário ter instalado:

- [Node.js](https://nodejs.org/) — versão 24 ou superior
- npm — instalado junto com o Node.js
- [Git](https://git-scm.com/)
- Acesso às credenciais do banco de dados PostgreSQL utilizado pelo projeto

Para verificar as instalações:

```bash
node -v
npm -v
git -v
```

## 1. Clonando o repositório

Clone o repositório e acesse a pasta do projeto:

```bash
git clone <https://github.com/anaclarays/elo.git>
cd elo
```

---

## 2. Configurando o banco de dados

O banco de dados do ELO utiliza PostgreSQL hospedado no Neon. Não é necessário instalar ou executar o PostgreSQL localmente.

Para configurar a conexão:

1. Solicite acesso às credenciais do banco de dados do projeto.
2. Obtenha as strings de conexão necessárias:
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
```

Outras variáveis de ambiente podem ser necessárias, especialmente para funcionalidades que utilizam envio de e-mails ou configurações específicas da aplicação. Consulte o arquivo `.env.example` para verificar todas as variáveis disponíveis.

**Importante:** nunca compartilhe o arquivo `.env` ou envie credenciais para o repositório. Ele contém informações sensíveis e deve permanecer fora do versionamento.

---

## 3. Executando o backend

Todos os comandos desta seção devem ser executados dentro da pasta `backend/`.

### Instalando as dependências

```bash
npm ci
```

O comando `npm ci` instala as dependências de acordo com as versões registradas no `package-lock.json`, garantindo maior consistência entre os ambientes de desenvolvimento.

### Executando em desenvolvimento

```bash
npm run start:dev
```

O backend estará disponível localmente em:

[http://localhost:3000](http://localhost:3000)

Caso a aplicação apresente erros de conexão com o banco de dados, verifique:

- Se o arquivo `.env` foi criado corretamente;
- Se `DATABASE_URL` e `DIRECT_URL` estão preenchidas;
- Se as credenciais estão válidas;
- Se o banco de dados está acessível.

---

## 4. Executando o frontend web

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

Durante o desenvolvimento local, as chamadas à API são encaminhadas ao backend, conforme a configuração do projeto.

### Compilando o frontend

Para gerar a versão de produção do frontend:

```bash
npm run build
```

O resultado da compilação será disponibilizado no diretório de build configurado pelo Vite.

---

## 5. Executando os testes

### Backend

Os testes automatizados do backend devem ser executados dentro da pasta `backend/`:

```bash
npm test
```

Utilize o script `npm test` disponibilizado no projeto, em vez de executar diretamente `npx jest`, pois o script configurado inclui os parâmetros necessários para execução das suítes de testes no ambiente Node.js utilizado.

### Frontend

Caso existam scripts de testes configurados no frontend, consulte os scripts disponíveis no `package.json`:

```bash
npm run
```

---

## 6. Adicionando ou atualizando dependências

Para adicionar uma nova dependência, acesse a pasta correspondente (`backend/` ou `frontend/`) e execute:

```bash
npm install <pacote>
```

Após adicionar ou atualizar dependências, os arquivos `package.json` e `package-lock.json` devem ser versionados juntos.

Para instalar as dependências de um projeto já configurado, prefira `npm ci`.

---

# Variáveis de ambiente

As variáveis de ambiente utilizadas pela aplicação são definidas nos arquivos `.env`, que não devem ser versionados.

Entre as configurações relevantes estão:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL com pooling |
| `DIRECT_URL` | String de conexão PostgreSQL direta |
| `JWT_SECRET` | Chave utilizada para operações relacionadas à autenticação JWT |
| `SMTP_*` | Configurações de envio de e-mails |
| `PASSWORD_RESET_URL` | URL utilizada no fluxo de redefinição de senha |
| `VITE_API_URL` | URL da API utilizada pelo frontend em ambientes específicos |
| `WEB_ORIGIN` | Origem permitida/configurada para comunicação com o frontend |

Consulte o arquivo `.env.example` do backend para verificar os nomes, valores esperados e configurações adicionais.

---

# Informações acadêmicas

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
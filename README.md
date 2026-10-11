# Elo

STATUS - Em desenvolvimento.

## Backend - Configuração do projeto 

### Pré-requisitos

Antes de executar o projeto, é necessário ter instalado:

- [Node.js](https://nodejs.org/)
- npm (geralmente instalado junto com o Node.js)
- Git

### Clonando o repositório

Clone o projeto e acesse a pasta:

```bash
git clone <URL_DO_REPOSITORIO>
cd elo
```
## Configuração do banco de dados (Neon)

O banco de dados do Sistema ELO é PostgreSQL, hospedado no Neon. Não é
necessário instalar ou rodar PostgreSQL localmente.

1. O documento com as credenciais do banco se encontra no Drive do
   projeto (na pasta `Banco de dados`).
2. Copie as duas strings de conexão do documento:
   - `DATABASE_URL` (com pooling)
   - `DIRECT_URL` (sem pooling)
3. Na raiz da pasta `backend/`, copie o arquivo de exemplo:
```bash
    cd backend
    cp .env.example .env
```
4. Abra o `.env` e cole as duas strings:
```
    DATABASE_URL="a-string-com-pooler-aqui"
    DIRECT_URL="a-string-sem-pooler-aqui"
```

**Nunca** compartilhe esse arquivo ou cole ele no Git!
 Ele já está no `.gitignore` do projeto.

### Siga o passo a passo 

- Acesse o backend: `cd backend`
- Instale as dependências: `npm install`
- Para executar o backend em ambiente de desenvolvimento: `npm run start:dev`

O backend estará disponível em: http://localhost:3000


Se aparecer esta linha no terminal, a conexão está funcionando:

    Conexão com o PostgreSQL (Neon) estabelecida: { now: ... }

Se aparecer um erro em vez disso, confira se o `.env` foi preenchido
corretamente e se você está rodando os comandos dentro de `backend/`.

**Importante:** todos os comandos abaixo devem ser rodados dentro da
pasta `backend/`, nunca na raiz do repositório.

## Frontend

Ainda não configurado
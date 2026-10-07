# elo

## Para configuração do typeScript

Execute os comandos para verificar as versões das stacks que vamos utilizar, se as versões aparecerem, pode seguir.
Caso alguma versão não apareça, é necessário realizar a sua instalação.

Comandos de verificação:
`npm --version` a versão deve ser 11..6.2
`npx --version` a versão deve ser 11.6.2
`node --version`a versão deve ser v24.12.0

Considerando que há o node.js instalado em sua máquina, execute: `npm install -g typescript`
E depois verifique a versão instalada, execute: `tsc --version` a versão correspondente deve ser 7.0.2

## instalando o projeto nestJs

Vamos usar o Nest CLI, porque ele já cria toda a estrutura inicial corretamente.
Primeiro, instale o CLI, execute o comando: `npm install -g @nestjs/cli` dentro da pasta do backend do projeto.
Verifique sua versão, execute: `nest --version`, a versão deve ser 12.0.8;

## como foi criada a configuração inicial do projeto:

Foi executado o comando `nest new backend`dentro da pasta do projeto para obtenção das estruturas dos arquivos;

## Para execução e verificação se a estrutura funciona e está carregando normalmente:

Execute o comando: `npm run start:dev`acesso o [localhost:3000](http://localhost:3000) em seu navegador e deverá aparecer Hello World!
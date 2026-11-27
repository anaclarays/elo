# Sugestões de IA — Como Funciona

Este documento explica como a aba **Sugestões de IA** foi implementada. A decisão de usar regras explicáveis, em vez de um modelo treinado ou de uma API externa de IA, está registrada na [ADR 008](../adr/008-sugestoes-ia.md).

O sistema analisa a agenda, a capacidade semanal da equipe e a lista de espera e propõe mudanças. Cada sugestão pode ser aprovada, modificada antes de aprovar ou descartada. Nada muda na agenda sem que uma pessoa decida.

## As regras

| Tipo | Quando aparece | O que faz ao aprovar |
|---|---|---|
| **Sobrecarga** | Profissional com mais atendimentos na semana do que a sua capacidade semanal (semana atual e a próxima) | Transfere o último atendimento excedente para alguém da mesma área, com folga, que atende naquele horário e está livre. Prefere quem já atende o mesmo tipo. |
| **Vaga para a fila** | Profissional com capacidade livre e família na lista de espera | Agenda a família no primeiro horário livre do profissional, seguindo a ordem da fila (RN34). A família sai da fila. |
| **Redução de frequência** | Paciente com mais de 4 atendimentos nos próximos 30 dias enquanto há famílias na fila | Cancela os atendimentos mais distantes que passam do limite. Eles continuam no histórico. |

Os números (4 atendimentos em 30 dias, até 10 sugestões de vaga, 1 hora de antecedência) ficam na constante `LIMITES`, em `sugestoes.regras.ts`. Se a coordenação definir outros valores, basta alterá-la ali.

## Organização do código

O módulo fica em `backend/src/sugestoes`, seguindo a arquitetura em camadas da ADR 006:

* `sugestoes.regras.ts`: as regras em si. É uma função pura (`gerarSugestoes`) que recebe a agenda, os profissionais, a fila e as decisões já tomadas e devolve a lista de sugestões. Não acessa o banco, o que facilita testar.
* `service/sugestoes.service.ts`: busca os dados, chama as regras, aplica as permissões e executa a decisão.
* `sugestoes.repository.ts`: consultas SQL e gravação das decisões.
* `controller/sugestoes.controller.ts` e `dto/`: rotas e validação da entrada.
* `test/`: testes de cada camada.

Na tela, tudo fica em `frontend/src/Sugestoes.tsx`.

## Fluxo de uma sugestão

1. **Listar** (`GET /sugestoes`): o backend calcula as sugestões. Cada uma recebe um id gerado a partir da situação que a originou (ex.: "sobrecarga, atendimento X, para a profissional Y"). A mesma situação gera sempre o mesmo id, e as sugestões já decididas são retiradas da lista.
2. **Aprovar** (`POST /sugestoes/:id/aprovar`): o backend recalcula para confirmar que a sugestão ainda vale. Se a situação mudou, retorna 404 e a tela atualiza a lista.
3. Em seguida, **grava a decisão antes de agir**. Como o id é único no banco, duas pessoas não conseguem aprovar a mesma sugestão (a segunda recebe 409).
4. Depois **executa** pela `AtendimentosService` (`create`, `update` ou `cancel`), com as validações da agenda (conflito de horário, horário do profissional, profissional inativo, data passada).
5. Se a agenda recusar, a decisão é **desfeita** e a sugestão volta para a lista.

**Modificar** (`POST /sugestoes/:id/modificar`) segue o mesmo fluxo, mas executa a ação já ajustada e exige um motivo:

* **vaga da fila:** dá para trocar o profissional, a data, o horário e o tipo;
* **transferência:** dá para trocar o profissional, a data e o horário;
* **redução:** dá para escolher quais dos atendimentos propostos cancelar.

O texto do que mudou fica salvo no histórico. Os atendimentos que a coordenação decide manter numa redução, desmarcando ao modificar ou descartando a sugestão, deixam de contar para o limite. Assim o sistema não volta a sugerir o mesmo cancelamento.

**Descartar** (`POST /sugestoes/:id/descartar`) só grava a decisão com o motivo. A agenda não muda.

## Quem vê e quem decide

* A **coordenação** vê e decide todas as sugestões.
* O **voluntário** vê e decide as sugestões que mudam a própria agenda. Ao modificar, pode mudar o horário, mas não trocar o profissional.
* A redução que cancelaria atendimento de outro profissional aparece para o voluntário, mas só a coordenação decide.
* A regra fica no backend: sugestão de outro profissional retorna 404, e a decisão sem permissão retorna 403.

## Banco de dados

A tabela `decisoes_sugestoes` guarda:

* a sugestão (`sugestao_id`, `tipo`, `titulo`);
* a decisão (`aprovada`, `modificada` ou `descartada`), com `motivo` e `ajuste`;
* os profissionais envolvidos e os atendimentos mantidos numa redução;
* quem decidiu e quando.

Descartar ou modificar sem motivo é barrado também por uma constraint do banco.

A tabela está na migration `007_decisoes_sugestoes.sql` e também é criada ou atualizada pelo backend ao iniciar (`database.service.ts`). Assim a funcionalidade não depende de alguém rodar a migration.

## Como adicionar uma regra nova

1. Escrever a função da regra em `sugestoes.regras.ts`, devolvendo título, motivo, consequência, profissionais envolvidos e a ação, e incluí-la em `gerarSugestoes`.
2. Se for um tipo novo, adicioná-lo em `TipoSugestao`, no `CHECK` da coluna `tipo` e no frontend (rótulo e ícone).
3. Se a ação for diferente das existentes (transferir, agendar, cancelar), tratá-la em `executar`, no service.
4. Escrever os testes em `test/sugestoes.regras.spec.ts`.

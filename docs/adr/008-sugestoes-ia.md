# ADR 008 - Sugestões de IA por Regras Explicáveis

* **Status:** Aceito
* **Data:** 26/11/2026
* **Decisores:** Layse Gomes.

## 1. Contexto

O Sistema ELO prevê uma camada de inteligência (ADR 006) que ajude a coordenação a organizar a agenda e a lista de espera. Na tela, essa camada é a aba **Sugestões de IA**: o sistema analisa a situação atual e propõe mudanças, como transferir um atendimento de um profissional sobrecarregado, chamar uma família da fila para uma vaga livre ou reduzir a frequência de quem passou do limite enquanto há famílias esperando.

Alguns requisitos guiaram a escolha da solução. Pela RN51, os indicadores apoiam a decisão e não substituem os profissionais, então nada pode mudar na agenda sem alguém aprovar. Na reunião de 29/09, foi pedido que cada sugestão dissesse por que foi feita e o que acontece se for aprovada. Além disso, os dados são de crianças e adolescentes, alguns com TEA, e pela LGPD não devem sair do sistema sem necessidade. Por fim, a ONG tem poucos profissionais e pouco histórico de atendimentos.

Foram consideradas três alternativas: um modelo de aprendizado de máquina treinado com os dados da ONG, a API de um modelo de linguagem externo (ChatGPT, Gemini, Claude etc.) e regras explicáveis escritas no próprio sistema.

## 2. Decisão

A equipe decidiu gerar as sugestões por **regras fixas e explicáveis**, escritas no backend, sem modelo treinado e sem serviço externo.

O modelo treinado foi descartado porque não há histórico suficiente para treinar algo confiável, e ele não explicaria por que fez cada sugestão. A API externa foi descartada porque exigiria enviar dados de pacientes para terceiros, teria custo por uso e daria respostas diferentes para a mesma situação, o que dificulta testar e auditar.

As sugestões são calculadas na hora, a cada consulta, a partir da agenda, da capacidade semanal da equipe e da lista de espera. Só as decisões ficam salvas: aprovar, modificar ou descartar, com quem decidiu, quando e o motivo. Toda mudança na agenda passa por uma pessoa e usa as mesmas operações e validações do agendamento manual. O nome "IA" foi mantido na tela porque é como a ONG conhece a funcionalidade.

As regras, o fluxo de decisão, as permissões e a estrutura do código estão descritos em [docs/architecture/sugestoes-ia.md](../architecture/sugestoes-ia.md).

## 3. Consequências positivas

* Cada sugestão é explicável: a tela mostra o motivo e a consequência, e a coordenação entende o que vai acontecer antes de aprovar.
* Nenhum dado de paciente sai do sistema, e não há custo de serviço externo.
* O resultado é previsível: a mesma situação gera a mesma sugestão, o que permite testes automatizados confiáveis.
* A agenda continua consistente, porque as mudanças usam as mesmas validações do agendamento manual.
* O histórico registra quem decidiu o quê, quando e por quê, o que ajuda a auditar.

## 4. Consequências negativas

* As regras não aprendem: só detectam as situações para as quais foram escritas, e cada caso novo exige código novo.
* Os limites usados nas regras (como 4 atendimentos por paciente em 30 dias) são estimativas iniciais e precisam ser validados com a coordenação.
* O nome "IA" pode criar a expectativa de um modelo inteligente, o que não é o caso. Isso deve ser explicado quando a funcionalidade for apresentada.
* As sugestões são recalculadas a cada consulta. Isso é adequado ao volume da ONG, mas pode precisar de cache se a agenda crescer muito.
* Uma sugestão pode deixar de valer entre a pessoa ver e aprovar (ex.: alguém ocupou o horário). Nesse caso a tela avisa e atualiza a lista.

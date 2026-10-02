# ADR 005 - Escolha das Stacks Frontend (Web e Mobile)

* **Status:** Aceito
* **Data:** 23/09/2026
* **Decisores:** Byanca Souza e Raiana Donato

## 1. Contexto

O ecossistema do Sistema ELO exige a entrega de duas interfaces frontend com propósitos e públicos distintos:
1. **Módulo de Gestão da Associação (Web):** voltado para a administração, painéis operacionais, relatórios e controle interno pela equipe da associação.
2. **Módulo das Famílias (Mobile):** voltado ao atendimento, acompanhamento e interação direta com as famílias através de dispositivos móveis.

Com o backend em NodeJS com TypeScript e NestJS em arquitetura de monólito modular (ADR 002) e o banco PostgreSQL no Neon já definidos, fez-se necessário formalizar a escolha das tecnologias que comporão as duas frentes do frontend.

Ambas as aplicações atuarão de forma desacoplada, comunicando-se via rede (HTTP/REST com autenticação JWT) com a API hospedada de forma independente. Conforme alinhado na estratégia do projeto, o foco inicial de desenvolvimento concentrou-se no Módulo de Gestão Web, deixando o aplicativo mobile como etapa seguinte. Ainda assim, a definição de ambas as stacks é essencial para garantir a padronização técnica desde o início.

A escolha levou em consideração:
* **Sinergia técnica:** Adoção do ecossistema JavaScript/TypeScript em todas as camadas da aplicação (backend e frontends);
* **Reaproveitamento de conhecimento:** Compartilhamento de conceitos de componentização, gerenciamento de estado e bibliotecas entre web e mobile;
* **Custo zero e agilidade:** Utilização de ferramentas consolidadas e gratuitas do ecossistema open-source.

## 2. Decisão

A equipe definiu a utilização do **React (Web)** para o Módulo de Gestão e do **React Native** para o Módulo das Famílias (Mobile).

A escolha fundamenta-se nos seguintes pontos:

* **Módulo de Gestão (React Web):** Escolhido por ser a biblioteca mais consolidada para interfaces web interativas, com vasto suporte a bibliotecas de componentes de UI, tabelas e dashboards, além de perfeita integração com a Vercel para deploys automáticos;
* **Módulo das Famílias (React Native):** Escolhido por permitir a criação de uma aplicação mobile nativa multiplataforma (Android e iOS) a partir de uma única base de código em TypeScript, evitando o custo de manter duas aplicações nativas separadas (Swift/Kotlin) ou introduzir uma nova linguagem (como Dart/Flutter);
* **Unificação de linguagem (TypeScript):** Todo o projeto (Backend NestJS, Web React e Mobile React Native) compartilha o mesmo idioma base, permitindo o reaproveitamento de tipagens de dados e facilitando a transição de desenvolvedores entre as frentes;
* **Comunicação descentralizada:** Tanto o React (Web) quanto o React Native (Mobile) consumiriam os mesmos endpoints REST da API NestJS de forma independente.

## 3. Consequências positivas

* **Padronização total do projeto:** Homogeneidade de código em TypeScript desde o banco/backend até as pontas Web e Mobile;
* **Curva de aprendizado reduzida:** Desenvolvedores que dominam o ecossistema React/Web conseguem atuar no aplicativo React Native com facilidade;
* **Agilidade no desenvolvimento mobile:** Uma única base de código para atender usuários Android e iOS;
* **Arquitetura desacoplada:** Independência entre a camada visual e as regras de negócio do backend.

## 4. Consequências negativas

* **Gerenciamento de múltiplos ambientes:** A equipe precisará manter e gerenciar dois projetos frontend distintos (Web e Mobile), além do repositório/módulo do backend;
* **Inatividade da API no plano gratuito:** Como a API no Render entra em repouso após 15 minutos de inatividade, requisições iniciais tanto da Web quanto do Mobile podem apresentar um *delay* de cerca de um minuto no primeiro carregamento;
* **Complexidade de build mobile:** O desenvolvimento e compilação do React Native exigem configurações e simuladores locais (Android Studio/XCode) mais complexos do que o ambiente web tradicional.
# ADR 007 - Escolha da Stack de Testes

**Status:** Aceito
**Data:** 01/10/2026
**Decisores:** Jaianny Souza.

## 1. Contexto

Com a definição da arquitetura do projeto baseada em NestJS no backend e React Native no frontend, surge a necessidade de estabelecer uma suíte de testes robusta. O objetivo é garantir a qualidade do código, prevenir regressões e assegurar a correta integração entre as plataformas.

Foi necessário selecionar ferramentas que suportem testes unitários, de integração e de componentes, mantendo a compatibilidade e a fluidez no ambiente TypeScript.

## 2. Decisão

Decidimos adotar a seguinte stack para a realização dos testes automatizados:

- **Test Runner Principal (Backend e Frontend):** Jest.
- **Testes de Integração/E2E (Backend):** Supertest (integrado ao Jest).
- **Testes de Componentes (Frontend):** React Native Testing Library (RNTL).

O Jest foi escolhido por ser o padrão de mercado para aplicações Node/React e por já vir nativamente configurado no scaffolding padrão do NestJS.

O Supertest será utilizado para simular chamadas HTTP na API, e a React Native Testing Library garantirá que os componentes mobile sejam testados com foco no comportamento e na experiência do usuário, em vez dos detalhes de implementação.

## 3. Consequências positivas

- **Padronização:** A utilização do Jest em ambas as camadas (front e back) diminui a carga cognitiva, permitindo que a mesma sintaxe de asserções seja usada em todo o projeto.
- **Integração nativa:** O NestJS já possui suporte e documentação oficial excelente para Jest e Supertest.
- **Foco no usuário:** O uso da React Native Testing Library incentiva a escrita de testes baseados na forma como os usuários interagem com o aplicativo (acessibilidade, toques, visibilidade), tornando os testes mais confiáveis.

## 4. Consequências negativas

- A configuração inicial do Jest em projetos React Native pode apresentar atritos caso haja dependência de bibliotecas nativas complexas (exigindo a criação de *mocks* manuais).
- Testes mais profundos do tipo *End-to-End* (E2E) no mobile exigirão, no futuro, a adoção de ferramentas mais pesadas (como Detox ou Maestro), já que o Jest + RNTL cobre apenas a renderização de componentes e lógica isolada.
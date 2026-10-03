# ADR 006 - Escolha do Padrão Arquitetural: Monólito Modular

**Status:** Aceito
**Data:** 23/09/2026
**Decisores:** Ana Clara Cavalcante, Ana Clara Bizarria, Jaianny Souza, Layse Gomes e Samara Petrilly.

## 1. Contexto

O Sistema ELO exige a integração entre dois módulos principais: uma plataforma web focada em gestão e um aplicativo mobile voltado para o atendimento das famílias. Diante do aumento de complexidade do sistema — que também inclui uma camada de inteligência —, foi necessário planejar uma estrutura sustentável e organizada.

Precisávamos de um padrão arquitetural que garantisse não apenas o isolamento dos domínios de negócio, mas também uma separação clara de responsabilidades técnicas, sem introduzir a complexidade de infraestrutura de uma arquitetura baseada em microsserviços.

## 2. Decisão

A equipe decidiu adotar a arquitetura de **Monólito Modular em Camadas**.

Nesta abordagem, o sistema será implantado como uma única unidade executável (monólito), mas o seu código-fonte será estruturado sob duas perspectivas:

1. **Modular (Por Domínio):** O código será dividido em módulos funcionais e independentes de acordo com o negócio (ex: Módulo de Famílias, Módulo de Gestão).
2. **Em Camadas (Técnica):** Dentro de cada módulo, o código será organizado em camadas com responsabilidades estritas, tipicamente divididas em Apresentação/Rotas (*Controllers*), Regras de Negócio (*Services*) e Acesso a Dados (*Repositories*).

Essa decisão alinha-se perfeitamente com a escolha do framework NestJS (documentada na ADR 002), que nativamente encoraja e fornece a estrutura de injeção de dependências necessária para sustentar esse modelo.

## 3. Consequências positivas

- **Separação Clara de Responsabilidades (SoC):** A divisão em camadas garante que a lógica de negócio fique isolada das regras de roteamento (HTTP) e do acesso ao banco de dados, tornando o código mais limpo.
- **Alta Testabilidade:** Com as camadas bem definidas, é muito mais fácil escrever testes unitários para as regras de negócio isoladamente, utilizando *mocks* para a camada de banco de dados.
- **Baixa complexidade de infraestrutura:** Evita a sobrecarga de gerenciamento de múltiplos ambientes e redes inerente aos microsserviços, comunicando os módulos diretamente em memória.
- **Evolução facilitada:** Mantém o sistema preparado para uma transição suave para microsserviços no futuro, caso a demanda exija.

## 4. Consequências negativas

- **Aumento de código repetitivo (Boilerplate):** A arquitetura em camadas exige a criação de múltiplos arquivos (Controller, Service, Repository, DTOs) mesmo para operações simples (como um CRUD básico).
- **Exigência de disciplina técnica:** O time precisará de rigor para não furar as fronteiras arquiteturais, evitando "vazar" regras de negócio para os *controllers* ou criar acoplamento direto entre os bancos de dados de módulos diferentes.
- **Deploy unificado:** Por ser um monólito, um erro crítico na compilação ou na execução de apenas um dos módulos afeta a disponibilidade do sistema como um todo.
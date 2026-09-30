# ADR 002 - Escolha das Stacks Tecnológicas para o Backend

* **Status:** Aceito
* **Data:** 23/09/2026
* **Decisores:** Ana Clara Cavalcante, Ana Clara Bizarria, Jaianny Souza, Layse Gomes e Samara Petrilly.

## 1. Contexto

A fase de planejamento do Sistema ELO contou com a definição das stacks tecnológicas para o desenvolvimento do seu backend, em outras palavras, a linguagem de programação que será utilizada e o framework que será aplicado para maior eficiência do trabalho.

Esse processo se deu através de discussões entre a equipe, levando em consideração, especialmente, a experiência técnica prévia das integrantes, contudo não deixando de lado a integração que deve ser feita entre os dois módulos principais, o web para gestão e o mobile para as famílias, e a implementação de uma camada de inteligência para o auxílio na gestão dos atendimentos, as quais conferem aumento significativo na complexidade do sistema. Também vale ressaltar o uso de ferramentas de Inteligência Artificial Generativa (ADR 001) para recomendações de stacks ao longo dos debates, contextualizando-a com esses mesmos fatores já citados.

As principais candidatas eram Java com Spring Boot, NodeJS com Express e NodeJS com NestJS; com a linguagem sendo JavaScript ou TypeScript.

## 2. Decisão

A equipe concluiu que o backend será desenvolvido no ambiente NodeJS com TypeScript e o framework NestJS, nativamente escrito em TS.

É precisamente a experiência prévia com o NodeJS que justifica a sua escolha, enquanto o escopo do ELO fez surgir a necessidade de maior organização e segurança no código que o TypeScript traz consigo, graças aos seus tipos estáticos e interfaces. Já o NestJS foi o framework eleito pela vasta gama de funcionalidades voltadas a uma arquitetura modular em camadas, oferecendo suporte para a criação de *modules*, cada um com seus *controllers* e *providers* (*services*, *repositories*, etc); isso coincide com a estratégia da equipe. Por outro lado, em relação às opções descartadas, apesar da combinação Java e Spring Boot apresentar ótima robustez, a equipe tem pouca experiência com as stacks; já o Express com Node não possui uma estrutura tão completa quanto o NestJS para a atender à complexidade do sistema de maneira fluida.

Para reforçar a organização do NestJS, a sua própria documentação menciona que sua arquitetura foi fortemente inspirada em Angular, framework em TypeScript para o frontend, e também demonstra semelhanças com o Spring Boot.

## 3. Consequências positivas

* Sintaxe familiar baseada em JavaScript, permitindo maior acomodação da equipe;
* Nível de abstração maior para a programação de componentes mais robustos;
* Melhor definição de padrões com o TypeScript e o NestJS, tornando o código mais legível e simples de escrever mesmo em equipes grandes;
* Código mais seguro, ou seja, menos suscetível a bugs, os quais também podem ser mais rapidamente corrigidos;
* Mais facilidade na criação de testes automatizados;
* Validação e tipagem dos dados de entrada e saída da API por meio de DTOs (Data Transfer Objects).

## 4. Consequências negativas

* Curva de aprendizado maior, o que pode comprometer o tempo de desenvolvimento;
* Risco de tentar aproveitar todas as funcionalidades disponibilizadas pelo framework e aumentar desnecessariamente a complexidade do código;
* Maior esforço inicial para tipar o código e lidar com erros de compilação, especialmente para quem não tem experiência com TypeScript;
* O NestJS deixa o código menos flexível, quando comparado ao Express.
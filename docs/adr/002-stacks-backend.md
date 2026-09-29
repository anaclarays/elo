## ADR 002 - Escolha das Stacks Tecnológicas para o Backend

* **Status:** Aceito
* **Data:** 23/09/2026
* **Decisores:** Ana Clara Cavalcante, Ana Clara Bizarria, Jaianny Souza, Layse Gomes e Samara Petrilly.

## 1. Contexto

A fase de planejamento do Sistema ELO contou com a definição das stacks tecnológicas para o desenvolvimento do seu backend, em outras palavras, a linguagem de programação que será utilizada e o framework que será aplicado para maior eficiência do trabalho.

Esse processo se deu através de discussões entre a equipe, levando em consideração, especialmente, a experiência técnica prévia das integrantes, contudo não deixando de lado a integração que deve ser feita entre os dois módulos principais e a implementação de uma camada de inteligência para o auxílio na gestão dos atendimentos, as quais conferem aumento significativo na complexidade do sistema. Também vale ressaltar o uso de ferramentas de Inteligência Artificial Generativa para recomendações de stacks ao longo dos debates, contextualizando-a com esses mesmos fatores já citados.

As principais candidatas eram Java com Spring Boot, NodeJS com Express e NodeJS com NestJS; com a linguagem sendo JavaScript ou TypeScript.

## 2. Decisão

A equipe concluiu que o backend será desenvolvido no ambiente NodeJS com TypeScript e o framework NestJS, naturalmente escrito em TS.

É precisamente a experiência prévia com o NodeJS que justifica a sua escolha, enquanto o escopo do ELO fez surgir a necessidade de maior organização e segurança no código que o TypeScript traz consigo, graças aos seus tipos estáticos e interfaces. Já o NestJS foi o framework eleito pela vasta gama de funcionalidades voltadas a uma arquitetura modular em camadas, oferecendo suporte para a criação de *modules*, cada um com seus *controllers* e *providers* (*services*, *repositories*, etc); isso coincide com a estratégia da equipe.

A própria documentação do NestJS menciona que sua arquitetura foi fortemente inspirada em Angular, framework de JavaScript para o frontend. Ela também apresenta semelhanças com o Spring Boot, uma das opções consideradas.

## 3. Consequências positivas

* Sintaxe familiar baseada em JavaScript, permitindo maior acomodação da equipe;
* Nível de abstração maior para a programação de componentes mais robustos;
* Melhor definição de padrões com o TypeScript e o NestJS, tornando o código mais legível e simples de escrever mesmo em equipes grandes;
* Código mais seguro, ou seja, menos suscetível a bugs, os quais também podem ser mais rapidamente corrigidos;
* Mais facilidade na criação de testes automatizados;
* Interação com o banco de dados mais fluida, por conta do melhor gerenciamento dos DTOs (Data Transfer Objects).

## 4. Consequências negativas

* Curva de aprendizado maior, o que pode comprometer o tempo de desenvolvimento;
* Risco de tentar aproveitar todas as funcionalidades disponibilizadas pelo framework e aumentar desnecessariamente a complexidade do código;
* Erros relacionados à tipagem agora têm mais chances de acontecer;
* O NestJS deixa o código menos flexível, quando comparado ao Express.
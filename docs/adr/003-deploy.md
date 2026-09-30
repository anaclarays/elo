# ADR 003 - Estratégia de Deploy do Sistema Web e da API

* **Status:** Aceito
* **Data:** 30/09/2026
* **Decisores:** Layse Gomes.

## 1. Contexto

Com as stacks do Sistema ELO já definidas, sendo o backend em NodeJS com TypeScript e NestJS (ADR 002), organizado como um monólito modular, e a persistência em PostgreSQL hospedado no Neon, tornou-se necessário definir onde e como a aplicação será publicada, de forma que esteja acessível para testes, validações e apresentações ao longo da disciplina.

Embora a solução proposta pela Palavra em Ação preveja dois módulos integrados, o Módulo de Gestão da Associação (web) e o Módulo das Famílias (mobile), a equipe definiu como prioridade o desenvolvimento do módulo web durante a disciplina, considerando o prazo de três meses e o risco, já mapeado, de apenas um dos sistemas ser entregue por completo. Por isso, esta decisão trata do deploy do sistema web e da API, e deixa a publicação do aplicativo mobile para uma decisão futura. Mesmo assim, a estratégia de deploy precisa considerar desde já que a API será consumida futuramente pelo aplicativo das famílias, e não pode criar barreiras para essa integração.

Além disso, a escolha levou em consideração os seguintes fatores:

* O projeto não possui orçamento, portanto as plataformas devem oferecer um plano gratuito suficiente para o período da disciplina;
* A manutenção do sistema após o término da disciplina está fora do escopo do projeto, o que favorece soluções de configuração simples em vez de infraestrutura própria;
* O sistema lida com dados pessoais e sensíveis de crianças e adolescentes, sujeitos à LGPD;
* O requisito de manutenibilidade prevê testes automatizados e práticas que facilitem a evolução contínua do sistema.

As principais alternativas avaliadas foram: Vercel para o frontend com Render para a API; Render para ambos; Railway para ambos; Vercel para ambos, com a API em funções serverless; e um servidor virtual próprio (VPS) com Docker.

## 2. Decisão

A equipe concluiu que o frontend web será publicado na Vercel, a API em NestJS será publicada no Render como um *web service*, ambos em seus planos gratuitos, e o banco de dados permanecerá no Neon, cuja escolha é detalhada em ADR próprio.

A Vercel foi escolhida para o frontend por sua integração direta com o GitHub, realizando o deploy automático a cada alteração na branch principal e gerando um link de pré-visualização para cada *pull request*, o que facilita a revisão das entregas pela equipe. Já o Render foi escolhido para a API por executar aplicações NodeJS de forma contínua, sem as limitações de tempo de execução das funções serverless, o que é importante para a camada de inteligência do sistema, além de também oferecer deploy automático a partir do GitHub.

A API será publicada como um serviço independente do frontend, com endereço público fixo e HTTPS, para que possa ser consumida tanto pelo sistema web quanto, futuramente, pelo aplicativo mobile. Para que essa integração ocorra sem mudanças na infraestrutura, a API deverá:

* Utilizar autenticação baseada em token (JWT), compatível tanto com o navegador quanto com o aplicativo;
* Ser versionada (por exemplo, `/api/v1`), evitando que alterações futuras quebrem versões já instaladas do aplicativo;
* Ter as origens permitidas (CORS), credenciais e demais configurações definidas por variáveis de ambiente, nunca no código.

Em relação às opções descartadas, o Render para ambos os módulos seria igualmente viável, porém a Vercel oferece uma experiência superior para o frontend, especialmente com as pré-visualizações por *pull request*. O Railway foi descartado por oferecer apenas um crédito gratuito único, exigindo pagamento mensal após esse período. A Vercel para ambos foi descartada porque o NestJS não se adapta bem ao modelo serverless, que impõe limites de tempo de execução e não mantém estado entre requisições. Por fim, o servidor próprio foi descartado por exigir configuração e manutenção de infraestrutura (HTTPS, atualizações e segurança) incompatíveis com o prazo e a experiência da equipe.

A forma de distribuição do aplicativo mobile (lojas, APK ou outra) será registrada em um ADR próprio, quando o Módulo das Famílias entrar no escopo. Durante a disciplina, o sistema publicado utilizará apenas dados fictícios.

## 3. Consequências positivas

* Custo zero de hospedagem durante todo o período da disciplina;
* Deploy automático a cada alteração na branch principal, sem necessidade de configuração manual de servidores;
* Links de pré-visualização por *pull request*, facilitando a revisão e a validação das entregas;
* API desacoplada do frontend, permitindo a futura integração do aplicativo mobile sem mudanças na infraestrutura;
* Execução contínua da API, sem os limites de tempo das funções serverless, adequada à camada de inteligência;
* Configuração simples e bem documentada, compatível com a experiência da equipe.

## 4. Consequências negativas

* No plano gratuito do Render, a API é desligada após 15 minutos sem acessos e leva cerca de um minuto para voltar a responder, o que exige acessar o sistema alguns minutos antes das apresentações;
* A Vercel e o Render processam os dados em servidores fora do Brasil, o que reforça a necessidade de utilizar apenas dados fictícios durante a disciplina e de reavaliar a hospedagem caso o sistema passe a lidar com dados reais;
* O frontend e a API ficam em plataformas diferentes, exigindo a configuração de duas contas e o gerenciamento de variáveis de ambiente em ambas;
* O plano gratuito da Vercel é restrito a uso não comercial, e os limites de ambos os planos gratuitos podem exigir a migração para planos pagos caso o projeto continue após a disciplina;
* Quando o aplicativo mobile for lançado, o uso da API pelas famílias ocorrerá em horários imprevisíveis, e o desligamento por inatividade poderá prejudicar a experiência de usuários com baixo letramento digital, tornando necessária a migração para um plano pago;
* Recursos específicos do mobile, como notificações push, exigirão serviços adicionais ainda não avaliados.

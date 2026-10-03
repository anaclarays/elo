# ADR 004 - Escolha do Banco de Dados e Estratégia de Persistência

* **Status:** Aceito
* **Data:** 02/10/2026
* **Decisores:** Samara Petrilly.

## 1. Contexto
Com o backend do Sistema ELO definido em NodeJS, TypeScript e NestJS, coube à equipe decidir qual sistema gerenciador de banco de dados e qual estratégia de persistência seriam adotados, considerando tanto as necessidades do domínio quanto a viabilidade técnica dentro do prazo de três meses da disciplina.

O domínio do problema é fortemente relacional: profissionais, crianças e adolescentes, famílias, atendimentos, lista de espera, histórico clínico/evolutivo e atividades domiciliares se relacionam entre si constantemente, conforme mapeado nos diagramas de caso de uso e de fluxo de dados do projeto. Além disso, embora a equipe esteja priorizando a entrega do Módulo de Gestão (web) durante a disciplina, o sistema já precisa lidar com múltiplos usuários simultâneos, como gestores e profissionais, consultando e atualizando os mesmos dados. A camada de persistência também deve estar preparada para a futura integração com o Módulo das Famílias (mobile), permitindo que ambos os módulos operem de forma integrada e acessem os mesmos dados de maneira concorrente. Essa necessidade é reforçada pela exigência de que o sistema seja 100% online, tornando necessário o uso de um banco de dados capaz de gerenciar múltiplos acessos simultâneos sem criar barreiras técnicas para a evolução do projeto.

Outro fator decisivo foi a natureza sensível dos dados: por se tratar de informações de saúde de crianças e adolescentes, o sistema está sujeito à LGPD, o que exige controle de acesso por perfil, integridade referencial e possibilidade de auditoria. Soma-se ainda a necessidade de relatórios gerenciais e indicadores de desempenho (RF08), bem como a comparação entre atividades domiciliares e atendimentos presenciais (RF07), o que demanda boas capacidades analíticas do banco escolhido. 

Além disso, a escolha levou em consideração outros fatores relevantes: 
* O sistema precisa suportar um volume inicial de pelo menos 650 famílias (200 em atendimento + 450 na fila de espera) e crescer sem perda significativa de desempenho (RNF06).
* A equipe já possui experiência prévia com PostgreSQL e Neon, o que é relevante dado o risco de carga horária limitada já identificado pela equipe no plano do projeto.

## 2. Decisão
A equipe concluiu que o banco de dados do Sistema ELO será o PostgreSQL, hospedado no Neon, e que a camada de persistência utilizará consultas SQL diretamente, sem a adoção de um ORM.

A escolha do PostgreSQL se justifica, em primeiro lugar, pela natureza relacional do domínio: o modelo de dados do ELO é composto por entidades fortemente interligadas, o que se encaixa naturalmente em um banco relacional com suporte completo a chaves estrangeiras, constraints e transações. Em segundo lugar, o PostgreSQL foi projetado para múltiplos usuários lendo e escrevendo simultaneamente, o que é indispensável para a operação conjunta dos módulos web e mobile. Por fim, foi considerado a experiência prévia da equipe com a ferramenta, o que reduz a curva de aprendizado e facilita o desenvolvimento da solução.

A hospedagem no Neon foi escolhida por oferecer PostgreSQL serverless com plano gratuito suficiente para o período da disciplina, sem custo de infraestrutura própria, e por já ser familiar à equipe.

Quanto às alternativas descartadas, o Supabase seria uma opção igualmente viável de hospedagem PostgreSQL, mas foi descartado por não trazer vantagem adicional relevante em relação ao Neon, que a equipe já domina. O MySQL foi descartado por não apresentar vantagens relevantes em relação ao PostgreSQL para os requisitos identificados e por exigir a adoção de uma tecnologia com a qual a equipe possui menor experiência prévia. Já o MongoDB foi descartado por não ser a opção mais alinhada a um domínio tão fortemente relacional quanto o do ELO, no qual a integridade referencial entre pacientes, famílias, profissionais e atendimentos é central para o funcionamento do sistema.

## 3. Consequências positivas
* Modelo relacional compatível com a natureza altamente interconectada do domínio (pacientes, famílias, profissionais, atendimentos, atividades); 
* Suporte nativo a múltiplos usuários concorrentes, essencial para a operação simultânea dos módulos web e mobile;
* Recursos de segurança e integridade, como controle de permissões, constraints e transações, além da possibilidade de utilização de Row-Level Security quando aplicável;
* Hospedagem serverless no Neon reduz custo operacional e simplifica a configuração inicial do banco de dados. 
* Reaproveitamento da experiência e do conhecimento já consolidado pela equipe, o que mitiga o risco de atraso por carga horária limitada, já identificado no plano do projeto.
* A utilização do PostgreSQL padrão permite a migração do Neon para outro provedor, como Supabase, Railway ou uma instância própria, sem a necessidade de reestruturar o modelo de dados.

## 4. Consequências negativas
* O plano gratuito do Neon impõe limites de armazenamento e pode suspender o banco por inatividade, causando uma primeira requisição mais lenta após períodos sem uso.
* Por ser um banco relacional com schema definido, mudanças estruturais exigem migrations controladas, o que pede disciplina e coordenação da equipe ao longo do projeto.
* A utilização do Neon como provedor externo cria uma dependência de infraestrutura que está fora do controle da equipe, sujeitando o projeto a eventuais alterações nas políticas e condições do serviço gratuito.
* A adoção de uma arquitetura em que o banco não é acessado diretamente pelo aplicativo mobile exige que todas as operações sejam intermediadas pela API, aumentando a responsabilidade da camada de backend na implementação de autenticação, autorização e validação dos acessos.

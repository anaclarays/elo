-- Tipos enumerados
CREATE TYPE categoria_etaria_enum AS ENUM ('crianca', 'adolescente', 'adulto', 'idoso');
CREATE TYPE genero_enum AS ENUM ('masculino', 'feminino', 'outros');
CREATE TYPE estado_civil_enum AS ENUM ('solteiro', 'casado', 'uniao_estavel', 'separado', 'divorciado', 'viuvo');
CREATE TYPE terapia_enum AS ENUM (
  'acompanhamento_psiquiatrico',
  'acompanhamento_neurologico',
  'acompanhamento_psicologico',
  'acompanhamento_neuropedagogico',
  'acompanhamento_fonoaudiologico',
  'terapia_ocupacional',
  'fisioterapia',
  'outros'
);

-- Dados da pessoa com TEA
CREATE TABLE pacientes_tea (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cadastro        INTEGER GENERATED ALWAYS AS IDENTITY UNIQUE,
  data_cadastro          DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria              categoria_etaria_enum NOT NULL,
  nome_completo          VARCHAR(255) NOT NULL,
  data_nascimento        DATE NOT NULL,
  rg_ou_certidao         VARCHAR(50) NOT NULL,
  cpf                    CHAR(11) NOT NULL UNIQUE,
  genero                 genero_enum NOT NULL,
  frequenta_escola       BOOLEAN NOT NULL,
  nome_instituicao       VARCHAR(255),
  aguarda_diagnostico    BOOLEAN NOT NULL,
  parecer_especialista   BOOLEAN NOT NULL,
  parecer_quais          TEXT,
  laudo_medico           BOOLEAN NOT NULL,
  nivel_suporte          SMALLINT NOT NULL CHECK (nivel_suporte BETWEEN 1 AND 3),
  outros_diagnosticos    TEXT,
  realiza_terapias       BOOLEAN NOT NULL,
  terapias               terapia_enum[],
  terapia_outros         VARCHAR(255),
  medicacoes             TEXT,
  alergias               TEXT,
  ciptea                 BOOLEAN NOT NULL,
  bpc                    BOOLEAN NOT NULL,
  numero_cartao_sus      CHAR(15),
  observacoes            TEXT,
  responsavel_triagem_id UUID NOT NULL REFERENCES profissionais(id),
  ativo                  BOOLEAN NOT NULL DEFAULT TRUE,   -- remoção lógica (não perde histórico)
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Responsável legal (só criança/adolescente) + dados familiares e socioeconômicos
CREATE TABLE dados_familiares (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id                 UUID NOT NULL UNIQUE REFERENCES pacientes_tea(id),
  responsavel_nome            VARCHAR(255),
  responsavel_rg              VARCHAR(50),
  responsavel_cpf             CHAR(11),
  responsavel_data_nascimento DATE,
  estado_civil                estado_civil_enum NOT NULL,
  endereco                    VARCHAR(255) NOT NULL,
  numero                      VARCHAR(20) NOT NULL,
  bairro                      VARCHAR(100) NOT NULL,
  cidade                      VARCHAR(100) NOT NULL,
  estado                      CHAR(2) NOT NULL,
  contato                     VARCHAR(20) NOT NULL,
  email                       VARCHAR(255),
  nome_conjuge                VARCHAR(255),
  possui_filhos               BOOLEAN NOT NULL,
  qtd_meninas                 INTEGER CHECK (qtd_meninas >= 0),
  qtd_meninos                 INTEGER CHECK (qtd_meninos >= 0),
  num_pessoas_casa            INTEGER NOT NULL CHECK (num_pessoas_casa >= 1),
  renda_familiar              NUMERIC(12,2) CHECK (renda_familiar >= 0),
  recebe_bolsa_familia        BOOLEAN NOT NULL DEFAULT FALSE,
  recebe_outro_beneficio      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
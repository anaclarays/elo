-- Rodar depois de 002_pacientes_tea.sql e 003_atendimentos.sql

CREATE TYPE tipo_registro_clinico_enum AS ENUM (
  'atendimento',
  'avaliacao',
  'procedimento',
  'evolucao'
);

-- Histórico clínico e evolutivo (RF06). Cada registro pertence a um paciente de um dos dois cadastros.
-- ON DELETE CASCADE: se o paciente for removido de vez (RN18), os registros dele saem junto
CREATE TABLE registros_clinicos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id     INTEGER REFERENCES pacientes(id) ON DELETE CASCADE,
  paciente_tea_id UUID REFERENCES pacientes_tea(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES profissionais(id),
  atendimento_id  UUID REFERENCES atendimentos(id),
  tipo            tipo_registro_clinico_enum NOT NULL,
  data_realizacao DATE NOT NULL,
  titulo          VARCHAR(255) NOT NULL,
  descricao       TEXT,
  avaliacoes      TEXT,
  procedimentos   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT registros_clinicos_um_paciente_ck
    CHECK ((paciente_id IS NOT NULL) <> (paciente_tea_id IS NOT NULL))
);

-- Consultas do histórico: por paciente, do mais recente para o mais antigo
CREATE INDEX ix_registros_clinicos_paciente
  ON registros_clinicos (paciente_id, data_realizacao DESC)
  WHERE paciente_id IS NOT NULL;

CREATE INDEX ix_registros_clinicos_paciente_tea
  ON registros_clinicos (paciente_tea_id, data_realizacao DESC)
  WHERE paciente_tea_id IS NOT NULL;

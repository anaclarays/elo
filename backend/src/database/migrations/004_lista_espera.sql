-- RF05 - Controle da Lista de Espera e Critérios de Priorização
-- Rodar depois de 002_pacientes_tea.sql (e de 003_atendimentos.sql, se já existir)

CREATE TYPE motivo_saida_lista_espera_enum AS ENUM ('agendamento', 'manual');

-- Cada linha é uma passagem do paciente pela lista. Ao sair, a linha é encerrada
-- (data_saida preenchida) em vez de apagada, para manter o histórico.
CREATE TABLE lista_espera (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id     INTEGER REFERENCES pacientes(id),
  paciente_tea_id UUID REFERENCES pacientes_tea(id),
  data_entrada    TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_saida      TIMESTAMPTZ,
  motivo_saida    motivo_saida_lista_espera_enum,
  justificativa   TEXT,
  retirado_por    UUID REFERENCES profissionais(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- O registro aponta para exatamente um paciente (comum ou TEA)
  CONSTRAINT lista_espera_um_paciente_ck
    CHECK ((paciente_id IS NOT NULL) <> (paciente_tea_id IS NOT NULL)),

  -- Saída e motivo andam juntos
  CONSTRAINT lista_espera_saida_ck
    CHECK ((data_saida IS NULL) = (motivo_saida IS NULL)),

  -- RN33: retirada manual exige justificativa e quem retirou
  CONSTRAINT lista_espera_retirada_manual_ck
    CHECK (
      motivo_saida IS DISTINCT FROM 'manual'
      OR (retirado_por IS NOT NULL AND btrim(coalesce(justificativa, '')) <> '')
    )
);

-- RN31: no máximo um registro ativo (sem data_saida) por paciente
CREATE UNIQUE INDEX ux_lista_espera_paciente_ativo
  ON lista_espera (paciente_id)
  WHERE data_saida IS NULL AND paciente_id IS NOT NULL;

CREATE UNIQUE INDEX ux_lista_espera_paciente_tea_ativo
  ON lista_espera (paciente_tea_id)
  WHERE data_saida IS NULL AND paciente_tea_id IS NOT NULL;

-- RN34: a fila é lida sempre pela ordem de chegada
CREATE INDEX ix_lista_espera_fila
  ON lista_espera (data_entrada, id)
  WHERE data_saida IS NULL;

-- RN28 para quem já estava cadastrado antes desta migration: entra na lista
-- com a data do próprio cadastro, desde que ainda não tenha nenhum atendimento.
DO $$
DECLARE
  tem_atendimentos BOOLEAN := to_regclass('public.atendimentos') IS NOT NULL;
BEGIN
  IF tem_atendimentos THEN
    INSERT INTO lista_espera (paciente_id, data_entrada)
    SELECT p.id, p.created_at
    FROM pacientes p
    WHERE p.ativo
      AND NOT EXISTS (
        SELECT 1 FROM atendimentos a WHERE a.paciente_id::text = p.id::text
      );

    INSERT INTO lista_espera (paciente_tea_id, data_entrada)
    SELECT pt.id, pt.created_at
    FROM pacientes_tea pt
    WHERE pt.ativo
      AND NOT EXISTS (
        SELECT 1 FROM atendimentos a WHERE a.paciente_tea_id = pt.id
      );
  ELSE
    INSERT INTO lista_espera (paciente_id, data_entrada)
    SELECT p.id, p.created_at FROM pacientes p WHERE p.ativo;

    INSERT INTO lista_espera (paciente_tea_id, data_entrada)
    SELECT pt.id, pt.created_at FROM pacientes_tea pt WHERE pt.ativo;
  END IF;
END $$;

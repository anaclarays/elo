-- Decisões da coordenação sobre as sugestões automáticas.
-- As sugestões são calculadas na hora a partir da agenda e da lista de espera;
-- aqui fica só o que foi aprovado ou descartado, por quem, quando e por quê.
CREATE TYPE decisao_sugestao_enum AS ENUM ('aprovada', 'descartada');

CREATE TABLE decisoes_sugestoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sugestao_id   VARCHAR(64) NOT NULL UNIQUE,
  tipo          VARCHAR(30) NOT NULL
                CHECK (tipo IN ('sobrecarga', 'vaga_fila', 'reducao_frequencia')),
  titulo        TEXT NOT NULL,
  decisao       decisao_sugestao_enum NOT NULL,
  motivo        TEXT,
  decidido_por  UUID NOT NULL REFERENCES profissionais(id),
  decidido_em   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Descartar exige justificativa
  CONSTRAINT decisao_motivo_ck
    CHECK (decisao = 'aprovada' OR btrim(coalesce(motivo, '')) <> '')
);

CREATE INDEX decisoes_sugestoes_decidido_em_idx ON decisoes_sugestoes (decidido_em DESC);

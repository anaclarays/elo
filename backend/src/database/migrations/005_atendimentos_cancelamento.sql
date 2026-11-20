-- Cancelamento de atendimentos com histórico: o atendimento não é apagado,
-- passa a ter status "cancelado", com a data e o motivo do cancelamento
CREATE TYPE status_atendimento AS ENUM ('agendado', 'cancelado');

ALTER TABLE atendimentos
    ADD COLUMN status status_atendimento NOT NULL DEFAULT 'agendado',
    ADD COLUMN cancelado_em TIMESTAMPTZ,
    ADD COLUMN motivo_cancelamento TEXT,
    ADD CONSTRAINT cancelamento_ck
        CHECK ((status = 'cancelado') = (cancelado_em IS NOT NULL));

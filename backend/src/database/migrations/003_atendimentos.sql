CREATE TYPE tipo_atendimento AS ENUM ('psicologia', 'terapia ocupacional', 'pedagogia');

CREATE TABLE atendimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id INTEGER REFERENCES pacientes(id),
    paciente_tea_id UUID REFERENCES pacientes_tea(id),
    profissional_id UUID NOT NULL REFERENCES profissionais(id),
    data_inicio TIMESTAMPTZ NOT NULL,
    tipo tipo_atendimento NOT NULL,

    CONSTRAINT unico_paciente_ck
        CHECK ((paciente_id IS NOT NULL) <> (paciente_tea_id IS NOT NULL))
);

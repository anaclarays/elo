-- Atendimentos FICTÍCIOS da agenda, ligados aos pacientes de teste do histórico (RF06).
-- Use somente em desenvolvimento. Pode ser executado várias vezes.
-- Pré-requisitos: scripts 002 a 006 aplicados e a seed historico_clinico_dados_teste.sql.
DO $$
DECLARE
  v_profissional UUID;
  v_tea          UUID;
  v_paciente     INTEGER;
BEGIN
  SELECT id INTO v_profissional FROM profissionais WHERE ativo = true ORDER BY created_at LIMIT 1;
  SELECT id INTO v_tea FROM pacientes_tea WHERE cpf = '99999999901' AND ativo = true;
  SELECT id INTO v_paciente FROM pacientes WHERE numero_cadastro = 'SEED-HIST-001' AND ativo = true;
  IF v_profissional IS NULL OR v_tea IS NULL OR v_paciente IS NULL THEN
    RAISE EXCEPTION 'Rode antes a seed historico_clinico_dados_teste.sql';
  END IF;

  DELETE FROM atendimentos WHERE id IN (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd3', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'
  );

  INSERT INTO atendimentos
    (id, paciente_tea_id, profissional_id, data_inicio, tipo, status, cancelado_em, motivo_cancelamento)
  VALUES
    -- já aconteceu: deve aparecer
    ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', v_tea, v_profissional, '2026-09-10 13:00:00+00',
      'psicologia', 'agendado', NULL, NULL),
    -- já aconteceu, mas foi cancelado: deve aparecer com status "cancelado"
    ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', v_tea, v_profissional, '2026-10-14 14:00:00+00',
      'terapia ocupacional', 'cancelado', '2026-10-13 12:00:00+00', 'Cancelado para teste'),
    -- futuro: NÃO deve aparecer no histórico
    ('dddddddd-dddd-4ddd-8ddd-ddddddddddd3', v_tea, v_profissional, '2030-01-10 13:00:00+00',
      'pedagogia', 'agendado', NULL, NULL);

  INSERT INTO atendimentos
    (id, paciente_id, profissional_id, data_inicio, tipo, status, cancelado_em, motivo_cancelamento)
  VALUES
    ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', v_paciente, v_profissional, '2026-09-18 13:00:00+00',
      'pedagogia', 'agendado', NULL, NULL);
END
$$;
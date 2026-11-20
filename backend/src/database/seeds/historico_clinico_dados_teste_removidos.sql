-- Dados FICTÍCIOS, somente para desenvolvimento. Pode ser executado várias vezes.

DO $$
DECLARE
  v_profissional      UUID;
  v_paciente_removido INTEGER;
  c_tea_removido CONSTANT UUID := '22222222-2222-4222-8222-222222222222';
BEGIN
  SELECT id INTO v_profissional FROM profissionais WHERE ativo = true ORDER BY created_at LIMIT 1;
  IF v_profissional IS NULL THEN
    RAISE EXCEPTION 'Cadastre ao menos um profissional ativo antes de rodar este script';
  END IF;

  -- Paciente de TEA removido
  IF NOT EXISTS (SELECT 1 FROM pacientes_tea WHERE id = c_tea_removido) THEN
    INSERT INTO pacientes_tea (
      id, categoria, nome_completo, data_nascimento, rg_ou_certidao, cpf, genero,
      frequenta_escola, aguarda_diagnostico, parecer_especialista, laudo_medico,
      nivel_suporte, realiza_terapias, ciptea, bpc, responsavel_triagem_id, ativo
    ) VALUES (
      c_tea_removido, 'adulto', 'Seed Historico Removido TEA', '1985-06-01', '0000003', '99999999903',
      'masculino', false, false, false, true, 1, false, false, false, v_profissional, false
    );
  END IF;

  -- Paciente do cadastro de aprendizagem removido
  SELECT id INTO v_paciente_removido FROM pacientes WHERE numero_cadastro = 'SEED-HIST-REMOVIDO';
  IF v_paciente_removido IS NULL THEN
    INSERT INTO pacientes (
      numero_cadastro, nome_beneficiario, data_nascimento, rg, cpf, nome_mae, endereco, numero,
      bairro, cidade, cep, estado, contato, email, possui_irmaos, escola_frequenta, serie,
      possui_deficit, faz_acompanhamento, faz_uso_medicacao, data_cadastro, ativo
    ) VALUES (
      'SEED-HIST-REMOVIDO', 'Seed Historico Removido Beneficiario', '2013-05-20', '0000004', '99999999904',
      'Mae Teste', 'Rua Teste', '3', 'Centro', 'Araripina', '56280-000', 'PE', '87900000002',
      'seed.removido@teste.com', false, 'Escola Teste', '6º Ano', false, false, false, now(), false
    ) RETURNING id INTO v_paciente_removido;
  END IF;

  -- Registros dos pacientes removidos (ids fixos)
  DELETE FROM registros_clinicos
  WHERE id IN ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1');

  INSERT INTO registros_clinicos
    (id, paciente_tea_id, profissional_id, tipo, data_realizacao, titulo, descricao)
  VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', c_tea_removido, v_profissional, 'atendimento',
          '2026-09-15', '[SEED-REMOVIDO] Registro de paciente de TEA removido',
          'Registro de teste. Não deve aparecer, pois o paciente está removido.');

  INSERT INTO registros_clinicos
    (id, paciente_id, profissional_id, tipo, data_realizacao, titulo, descricao)
  VALUES ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', v_paciente_removido, v_profissional, 'atendimento',
          '2026-09-20', '[SEED-REMOVIDO] Registro de paciente removido (aprendizagem)',
          'Registro de teste. Não deve aparecer, pois o paciente está removido.');
END
$$;
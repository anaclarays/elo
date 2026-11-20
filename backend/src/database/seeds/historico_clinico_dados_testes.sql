-- Dados fictícios para testar o histórico clínico (RF06).
-- Use somente em desenvolvimento. Pode ser executado várias vezes: não duplica nada.
-- Pré-requisitos: scripts 002 e 003 aplicados e ao menos 1 profissional ativo.

DO $$
DECLARE
  v_profissional UUID;
  v_tea          UUID;
  v_paciente     INTEGER;
BEGIN
  SELECT id INTO v_profissional FROM profissionais WHERE ativo = true ORDER BY created_at LIMIT 1;
  IF v_profissional IS NULL THEN
    RAISE EXCEPTION 'Cadastre ao menos um profissional ativo antes de rodar este script';
  END IF;

  -- Paciente de TEA fictício
  SELECT id INTO v_tea FROM pacientes_tea WHERE cpf = '99999999901' AND ativo = true;
  IF v_tea IS NULL THEN
    INSERT INTO pacientes_tea (
      categoria, nome_completo, data_nascimento, rg_ou_certidao, cpf, genero,
      frequenta_escola, aguarda_diagnostico, parecer_especialista, laudo_medico,
      nivel_suporte, realiza_terapias, ciptea, bpc, responsavel_triagem_id
    ) VALUES (
      'adulto', 'Seed Historico Paciente TEA', '1990-01-15', '0000001', '99999999901', 'feminino',
      false, false, false, true, 1, false, false, false, v_profissional
    ) RETURNING id INTO v_tea;

    INSERT INTO dados_familiares (
      paciente_id, estado_civil, endereco, numero, bairro, cidade, estado, contato,
      possui_filhos, num_pessoas_casa
    ) VALUES (v_tea, 'solteiro', 'Rua Teste', '1', 'Centro', 'Araripina', 'PE', '87900000000', false, 1);
  END IF;

  -- Paciente do cadastro de aprendizagem fictício
  SELECT id INTO v_paciente FROM pacientes WHERE numero_cadastro = 'SEED-HIST-001';
  IF v_paciente IS NULL THEN
    INSERT INTO pacientes (
      numero_cadastro, nome_beneficiario, data_nascimento, rg, cpf, nome_mae, endereco, numero,
      bairro, cidade, cep, estado, contato, email, possui_irmaos, escola_frequenta, serie,
      possui_deficit, faz_acompanhamento, faz_uso_medicacao, data_cadastro
    ) VALUES (
      'SEED-HIST-001', 'Seed Historico Beneficiario', '2014-03-10', '0000002', '99999999902',
      'Mae Teste', 'Rua Teste', '2', 'Centro', 'Araripina', '56280-000', 'PE', '87900000001',
      'seed@teste.com', false, 'Escola Teste', '5º Ano', false, false, false, now()
    ) RETURNING id INTO v_paciente;
  END IF;

  -- Registros (apaga os de teste anteriores e recria)
  DELETE FROM registros_clinicos WHERE titulo LIKE '[SEED]%';

  INSERT INTO registros_clinicos
    (paciente_tea_id, profissional_id, tipo, data_realizacao, titulo, descricao, avaliacoes, procedimentos)
  VALUES
    (v_tea, v_profissional, 'avaliacao',    '2026-08-05', '[SEED] Avaliação inicial',
      'Primeira avaliação da pessoa atendida. Dados fictícios.', 'Avaliação de linguagem e interação social', NULL),
    (v_tea, v_profissional, 'atendimento',  '2026-08-19', '[SEED] Primeira sessão de terapia ocupacional',
      'Sessão de adaptação ao ambiente e à rotina.', NULL, 'Atividades de integração sensorial'),
    (v_tea, v_profissional, 'procedimento', '2026-09-02', '[SEED] Aplicação de protocolo sensorial',
      'Aplicação do protocolo definido para a fase inicial.', NULL, 'Protocolo sensorial, etapa 1'),
    (v_tea, v_profissional, 'atendimento',  '2026-09-16', '[SEED] Sessão de acompanhamento',
      'Sessão de acompanhamento com boa participação.', NULL, 'Atividades de coordenação motora'),
    (v_tea, v_profissional, 'evolucao',     '2026-10-07', '[SEED] Evolução do trimestre',
      'Melhora na comunicação e na tolerância a mudanças de rotina.', NULL, NULL),
    (v_tea, v_profissional, 'avaliacao',    '2026-11-04', '[SEED] Reavaliação',
      'Reavaliação geral após três meses de acompanhamento.', 'Reavaliação de linguagem e interação social', NULL);

  INSERT INTO registros_clinicos
    (paciente_id, profissional_id, tipo, data_realizacao, titulo, descricao, avaliacoes, procedimentos)
  VALUES
    (v_paciente, v_profissional, 'avaliacao',   '2026-09-10', '[SEED] Avaliação psicopedagógica',
      'Avaliação das dificuldades de leitura e escrita.', 'Avaliação de leitura e escrita', NULL),
    (v_paciente, v_profissional, 'atendimento', '2026-09-24', '[SEED] Sessão de reforço em leitura',
      'Atividades de leitura com apoio visual.', NULL, 'Leitura guiada'),
    (v_paciente, v_profissional, 'evolucao',    '2026-10-22', '[SEED] Evolução em leitura e escrita',
      'Avanço na leitura de palavras simples.', NULL, NULL);
END
$$;
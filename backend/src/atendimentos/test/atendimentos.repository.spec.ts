import { jest } from '@jest/globals';
import type { Pool } from 'pg';
import { AtendimentosRepository } from '../atendimentos.repository';
import { TipoAtendimento } from '../dto/create-atendimento.dto';

describe('AtendimentosRepository', () => {
  let repository: AtendimentosRepository;
  const pool = {
    query:
      jest.fn<
        (query: string, values?: unknown[]) => Promise<{ rows: unknown[] }>
      >(),
    connect: jest.fn<() => Promise<unknown>>(),
  };

  const client = {
    query:
      jest.fn<
        (query: string, values?: unknown[]) => Promise<{ rows: unknown[] }>
      >(),
    release: jest.fn(),
  };

  const dataInicio = new Date('2026-10-29T13:00:00.000Z');

  const atendimentoId = 'e695038b-6355-4db4-b833-48f5062a3aab';
  const pacienteId = 'paciente-23';
  const pacienteTeaId = '7a63fc53-ea95-4cd7-8a59-dd45d807d696';

  const atendimento = {
    id: atendimentoId,
    pacienteId,
    isTea: false,
    profissionalId: '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
    dataInicio,
    dataFim: new Date(dataInicio.getTime() + 20 * 60 * 1000),
    tipo: TipoAtendimento.PSICOLOGIA,
  };

  beforeEach(() => {
    repository = new AtendimentosRepository(pool as unknown as Pool);
    jest.clearAllMocks();
  });

  it('insere um atendimento usando valores parametrizados e retorna o registro', async () => {
    pool.query.mockResolvedValue({ rows: [atendimento] });

    const result = await repository.create({
      pacienteId,
      isTea: false,
      profissionalId: '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
      dataInicio,
      tipo: TipoAtendimento.PSICOLOGIA,
    });

    expect(result).toEqual(atendimento);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'INSERT INTO atendimentos (paciente_id, profissional_id, data_inicio, tipo)',
      ),
      [
        pacienteId,
        '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
        dataInicio,
        TipoAtendimento.PSICOLOGIA,
      ],
    );
    expect(pool.query.mock.calls[0][0]).not.toContain(pacienteId);
  });

  it('insere um atendimento de paciente TEA usando a referência UUID', async () => {
    const atendimentoTea = {
      ...atendimento,
      pacienteId: pacienteTeaId,
      isTea: true,
    };
    pool.query.mockResolvedValue({ rows: [atendimentoTea] });

    await expect(
      repository.create({
        pacienteId: pacienteTeaId,
        isTea: true,
        profissionalId: atendimento.profissionalId,
        dataInicio,
        tipo: TipoAtendimento.PSICOLOGIA,
      }),
    ).resolves.toEqual(atendimentoTea);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'INSERT INTO atendimentos (paciente_tea_id, profissional_id, data_inicio, tipo)',
      ),
      [
        pacienteTeaId,
        atendimento.profissionalId,
        dataInicio,
        TipoAtendimento.PSICOLOGIA,
      ],
    );
  });

  it('propaga erro ao gravar uma referência de paciente inválida', async () => {
    const error = new Error('violação da referência de paciente');
    pool.query.mockRejectedValue(error);

    await expect(
      repository.create({
        pacienteId,
        isTea: false,
        profissionalId: atendimento.profissionalId,
        dataInicio,
        tipo: TipoAtendimento.PSICOLOGIA,
      }),
    ).rejects.toBe(error);
    expect(pool.query.mock.calls[0][0]).toContain('(paciente_id,');
  });

  it('propaga erro ao gravar uma referência UUID de paciente TEA inválida', async () => {
    const error = new Error('violação da referência de paciente TEA');
    pool.query.mockRejectedValue(error);

    await expect(
      repository.create({
        pacienteId: 'uuid-invalido',
        isTea: true,
        profissionalId: atendimento.profissionalId,
        dataInicio,
        tipo: TipoAtendimento.PSICOLOGIA,
      }),
    ).rejects.toBe(error);
    expect(pool.query.mock.calls[0][0]).toContain('(paciente_tea_id,');
  });

  it('lança erro quando a criação não retorna o registro inserido', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(
      repository.create({
        pacienteId,
        isTea: false,
        profissionalId: '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
        dataInicio,
        tipo: TipoAtendimento.PSICOLOGIA,
      }),
    ).rejects.toThrow(
      'A criação do atendimento não retornou o registro inserido.',
    );
  });

  it('retorna os atendimentos ordenados pela data de início', async () => {
    pool.query.mockResolvedValue({ rows: [atendimento] });

    await expect(repository.findAll()).resolves.toEqual([atendimento]);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY data_inicio DESC, id DESC'),
    );
  });

  it('retorna o atendimento correspondente ao id', async () => {
    pool.query.mockResolvedValue({ rows: [atendimento] });

    await expect(repository.findOne(atendimentoId)).resolves.toEqual(
      atendimento,
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM atendimentos WHERE id = $1'),
      [atendimentoId],
    );
  });

  it('retorna null quando não encontra um atendimento pelo id', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(repository.findOne(atendimentoId)).resolves.toBeNull();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM atendimentos WHERE id = $1'),
      [atendimentoId],
    );
  });

  it('atualiza o paciente e limpa a referência TEA', async () => {
    pool.query.mockResolvedValue({ rows: [atendimento] });

    await expect(
      repository.update(atendimentoId, {
        pacienteId,
        isTea: false,
        profissionalId: atendimento.profissionalId,
        dataInicio,
        tipo: TipoAtendimento.PEDAGOGIA,
      }),
    ).resolves.toEqual(atendimento);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'SET paciente_id = $1,\n          paciente_tea_id = NULL',
      ),
      [
        pacienteId,
        atendimento.profissionalId,
        dataInicio,
        TipoAtendimento.PEDAGOGIA,
        atendimentoId,
      ],
    );
  });

  it('atualiza o paciente TEA e limpa a referência de paciente', async () => {
    const atendimentoTea = {
      ...atendimento,
      pacienteId: pacienteTeaId,
      isTea: true,
    };
    pool.query.mockResolvedValue({ rows: [atendimentoTea] });

    await expect(
      repository.update(atendimentoId, {
        pacienteId: pacienteTeaId,
        isTea: true,
        profissionalId: atendimento.profissionalId,
        dataInicio,
        tipo: TipoAtendimento.PSICOLOGIA,
      }),
    ).resolves.toEqual(atendimentoTea);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'SET paciente_tea_id = $1,\n          paciente_id = NULL',
      ),
      [
        pacienteTeaId,
        atendimento.profissionalId,
        dataInicio,
        TipoAtendimento.PSICOLOGIA,
        atendimentoId,
      ],
    );
  });

  it('retorna null quando a atualização não encontra um atendimento', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(
      repository.update(atendimentoId, {
        pacienteId,
        isTea: false,
        profissionalId: atendimento.profissionalId,
        dataInicio,
        tipo: TipoAtendimento.PEDAGOGIA,
      }),
    ).resolves.toBeNull();
  });

  it('retorna true quando remove um atendimento', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: atendimentoId }] });

    await expect(repository.remove(atendimentoId)).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM atendimentos WHERE id = $1 RETURNING id',
      [atendimentoId],
    );
  });

  it('retorna false quando não encontra um atendimento para remover', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(repository.remove(atendimentoId)).resolves.toBe(false);
  });

  it('identifica conflito de horário para o mesmo paciente', async () => {
    pool.query.mockResolvedValue({ rows: [{ conflito_horario: true }] });

    await expect(
      repository.hasTimeConflict(pacienteId, dataInicio, 'paciente'),
    ).resolves.toBe(true);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE paciente_id = $1'),
      [pacienteId, dataInicio],
    );
    expect(pool.query.mock.calls[0][0]).toContain(
      "data_inicio < $2::timestamptz + INTERVAL '20 minutes'",
    );
    expect(pool.query.mock.calls[0][0]).toContain(
      "data_inicio + INTERVAL '20 minutes' > $2::timestamptz",
    );
  });

  it('identifica conflito de horário para um paciente TEA', async () => {
    pool.query.mockResolvedValue({ rows: [{ conflito_horario: true }] });

    await expect(
      repository.hasTimeConflict(pacienteTeaId, dataInicio, 'paciente_tea'),
    ).resolves.toBe(true);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE paciente_tea_id = $1'),
      [pacienteTeaId, dataInicio],
    );
  });

  it('retorna false quando não há conflito de horário para o profissional', async () => {
    pool.query.mockResolvedValue({ rows: [{ conflito_horario: false }] });

    await expect(
      repository.hasTimeConflict(
        '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
        dataInicio,
        'profissional',
      ),
    ).resolves.toBe(false);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE profissional_id = $1'),
      ['7a63fc53-ea95-4cd7-8a59-dd45d807d696', dataInicio],
    );
  });

  it('ignora o próprio atendimento ao verificar conflito na atualização', async () => {
    pool.query.mockResolvedValue({ rows: [{ conflito_horario: false }] });

    await repository.hasTimeConflict(
      pacienteId,
      dataInicio,
      'paciente',
      atendimentoId,
    );

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('AND id <> $3'),
      [pacienteId, dataInicio, atendimentoId],
    );
  });

  it('verifica se o paciente comum existe e está ativo', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    await expect(repository.isPacienteAtivo(23, false)).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT 1 FROM pacientes WHERE id = $1 AND ativo = true',
      [23],
    );
  });

  it('verifica o paciente TEA na tabela pacientes_tea', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(repository.isPacienteAtivo(pacienteTeaId, true)).resolves.toBe(
      false,
    );
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT 1 FROM pacientes_tea WHERE id = $1 AND ativo = true',
      [pacienteTeaId],
    );
  });

  describe('emTransacao', () => {
    beforeEach(() => {
      pool.connect.mockResolvedValue(client);
      client.query.mockResolvedValue({ rows: [] });
    });

    it('executa a operação entre BEGIN e COMMIT e libera o client', async () => {
      const resultado = await repository.emTransacao(async (executor) => {
        await executor.query('SELECT 1');
        return 'ok';
      });

      expect(resultado).toBe('ok');
      expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
        'BEGIN',
        'SELECT 1',
        'COMMIT',
      ]);
      expect(client.release).toHaveBeenCalledTimes(1);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('desfaz tudo com ROLLBACK quando a operação falha', async () => {
      const error = new Error('falha no meio da transação');

      await expect(
        repository.emTransacao(async () => {
          throw error;
        }),
      ).rejects.toBe(error);

      expect(client.query.mock.calls.map(([sql]) => sql)).toEqual([
        'BEGIN',
        'ROLLBACK',
      ]);
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  it('cria o atendimento com o client da transação, quando recebido', async () => {
    client.query.mockResolvedValue({ rows: [atendimento] });

    await repository.create(
      {
        pacienteId,
        isTea: false,
        profissionalId: '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
        dataInicio,
        tipo: TipoAtendimento.PSICOLOGIA,
      },
      client,
    );

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('atualiza o atendimento com o client da transação, quando recebido', async () => {
    client.query.mockResolvedValue({ rows: [atendimento] });

    await repository.update(
      atendimentoId,
      {
        pacienteId,
        isTea: false,
        profissionalId: '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
        dataInicio,
        tipo: TipoAtendimento.PSICOLOGIA,
      },
      client,
    );

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

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
  };

  const dataInicio = new Date('2026-10-29T13:00:00.000Z');

  const atendimento = {
    id: 1,
    pacienteId: 23,
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
      pacienteId: 23,
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
        23,
        '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
        dataInicio,
        TipoAtendimento.PSICOLOGIA,
      ],
    );
    expect(pool.query.mock.calls[0][0]).not.toContain(
      '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
    );
  });

  it('lança erro quando a criação não retorna o registro inserido', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(
      repository.create({
        pacienteId: 23,
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

    await expect(repository.findOne(1)).resolves.toEqual(atendimento);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM atendimentos WHERE id = $1'),
      [1],
    );
  });

  it('retorna null quando não encontra um atendimento pelo id', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(repository.findOne(23)).resolves.toBeNull();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM atendimentos WHERE id = $1'),
      [23],
    );
  });

  it('atualiza somente os campos informados e parametriza o id', async () => {
    pool.query.mockResolvedValue({ rows: [atendimento] });

    await expect(
      repository.update(1, { tipo: TipoAtendimento.PEDAGOGIA }),
    ).resolves.toEqual(atendimento);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE atendimentos SET tipo = $1 WHERE id = $2',
      ),
      [TipoAtendimento.PEDAGOGIA, 1],
    );
  });

  it('retorna null quando a atualização não encontra um atendimento', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(
      repository.update(23, { tipo: TipoAtendimento.PEDAGOGIA }),
    ).resolves.toBeNull();
  });

  it('retorna true quando remove um atendimento', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await expect(repository.remove(1)).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM atendimentos WHERE id = $1 RETURNING id',
      [1],
    );
  });

  it('retorna false quando não encontra um atendimento para remover', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(repository.remove(23)).resolves.toBe(false);
  });

  it('identifica conflito de horário para o mesmo paciente', async () => {
    pool.query.mockResolvedValue({ rows: [{ conflito_horario: true }] });

    await expect(
      repository.hasTimeConflict(23, dataInicio, 'paciente'),
    ).resolves.toBe(true);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE paciente_id = $1'),
      [23, dataInicio],
    );
    expect(pool.query.mock.calls[0][0]).toContain(
      "data_inicio < $2::timestamptz + INTERVAL '20 minutes'",
    );
    expect(pool.query.mock.calls[0][0]).toContain(
      "data_inicio + INTERVAL '20 minutes' > $2::timestamptz",
    );
  });

  it('retorna false quando não há conflito de horário para o profissional', async () => {
    pool.query.mockResolvedValue({ rows: [{ conflito_horario: false }] });

    await expect(
      repository.hasTimeConflict('7a63fc53-ea95-4cd7-8a59-dd45d807d696', dataInicio, 'profissional'),
    ).resolves.toBe(false);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE profissional_id = $1'),
      ['7a63fc53-ea95-4cd7-8a59-dd45d807d696', dataInicio],
    );
  });
});

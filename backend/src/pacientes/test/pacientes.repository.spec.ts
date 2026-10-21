import { jest } from '@jest/globals';
import type { Pool } from 'pg';
import { PacientesRepository } from '../pacientes.repository';

describe('PacientesRepository', () => {
  let repository: PacientesRepository;
  const pool = {
    query:
      jest.fn<
        (query: string, values?: unknown[]) => Promise<{ rows: unknown[] }>
      >(),
  };

  const patient = {
    id: 1,
    numeroCadastro: '12345',
    dataCadastro: '2026-10-18T12:00:00.000Z',
    nomeBeneficiario: 'João',
    dataNascimento: '2010-01-01',
    rg: '1234567',
    cpf: '111.444.777-35',
    nomeMae: 'Maria',
    endereco: 'Rua A',
    numero: '10',
    bairro: 'Centro',
    cidade: 'Araripina',
    cep: '56280-000',
    estado: 'PE',
    contato: '87999999999',
    email: 'joao@email.com',
    possuiIrmaos: false,
    escolaFrequenta: 'Escola Municipal',
    serie: '7º Ano',
    possuiDeficit: false,
    fazAcompanhamento: false,
    fazUsoMedicacao: false,
    nomePai: null,
    acompanhanteEscolar: null,
  };

  beforeEach(() => {
    repository = new PacientesRepository(pool as unknown as Pool);
    jest.clearAllMocks();
  });

  it('inserts a patient using parameterized values and returns its record', async () => {
    pool.query.mockResolvedValue({ rows: [patient] });

    const result = await repository.create({
      numeroCadastro: '12345',
      dataCadastro: '2026-10-18T12:00:00.000Z',
      nomeBeneficiario: 'João',
      dataNascimento: '2010-01-01',
      rg: '1234567',
      cpf: '111.444.777-35',
      nomeMae: 'Maria',
      endereco: 'Rua A',
      numero: '10',
      bairro: 'Centro',
      cidade: 'Araripina',
      cep: '56280-000',
      estado: 'PE',
      contato: '87999999999',
      email: 'joao@email.com',
      possuiIrmaos: false,
      escolaFrequenta: 'Escola Municipal',
      serie: '7º Ano',
      possuiDeficit: false,
      fazAcompanhamento: false,
      fazUsoMedicacao: false,
    });

    expect(result).toEqual(patient);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO pacientes'),
      expect.arrayContaining(['12345', 'João']),
    );
    expect(pool.query.mock.calls[0][0]).not.toContain('João');
  });

  it('returns patients ordered by registration date', async () => {
    pool.query.mockResolvedValue({ rows: [patient] });

    await expect(repository.findAll()).resolves.toEqual([patient]);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY data_cadastro DESC, id DESC'),
    );
  });

  it('returns null when a patient id is not found', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(repository.findOne(23)).resolves.toBeNull();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      [23],
    );
  });

  it('updates only the supplied fields and parameterizes the id', async () => {
    pool.query.mockResolvedValue({ rows: [patient] });

    await expect(
      repository.update(1, { nomeBeneficiario: 'João Silva' }),
    ).resolves.toEqual(patient);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'UPDATE pacientes SET nome_beneficiario = $1 WHERE id = $2',
      ),
      ['João Silva', 1],
    );
  });

  it('returns null when an update targets no patient', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(
      repository.update(23, { nomeBeneficiario: 'João Silva' }),
    ).resolves.toBeNull();
  });

  it('reports whether a patient was deleted', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await expect(repository.remove(1)).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE pacientes SET ativo = false, updated_at = now() WHERE id = $1 RETURNING id',
      [1],
    );
  });
});

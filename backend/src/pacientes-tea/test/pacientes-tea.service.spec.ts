import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PacientesTeaService } from '../service/pacientes-tea.service';
import { PG_POOL } from '../../database/database.constants';
import { CategoriaEtaria, EstadoCivil, Genero } from '../enum/pacientes-tea.enum';

describe('PacientesTeaService', () => {
  let service: PacientesTeaService;
  const mockClient = { query: jest.fn(), release: jest.fn() };
  const mockPool = { query: jest.fn(), connect: jest.fn() };

  const dadosFamiliares = {
    estadoCivil: EstadoCivil.CASADO,
    endereco: 'Rua das Flores',
    numero: '100',
    bairro: 'Centro',
    cidade: 'Araripina',
    estado: 'PE',
    contato: '87999999999',
    possuiFilhos: false,
    numPessoasCasa: 4,
  };

  const dtoCrianca = {
    categoria: CategoriaEtaria.CRIANCA,
    nomeCompleto: 'Paciente Teste',
    dataNascimento: '2018-05-10',
    rgOuCertidao: '1234567',
    cpf: '111.444.777-35',
    genero: Genero.MASCULINO,
    frequentaEscola: true,
    nomeInstituicao: 'Escola Municipal',
    aguardaDiagnostico: false,
    parecerEspecialista: false,
    laudoMedico: true,
    nivelSuporte: 2,
    realizaTerapias: false,
    ciptea: false,
    bpc: false,
    responsavelTriagemId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    responsavelLegal: {
      nome: 'Responsável Teste',
      rg: '7654321',
      cpf: '52998224725',
      dataNascimento: '1985-03-20',
    },
    dadosFamiliares,
  };

  // Simula o client da transação: responde conforme o comando SQL recebido
  function simularTransacao() {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO pacientes_tea')) return { rows: [{ id: 'p1', numero_cadastro: 1 }] };
      if (sql.includes('INSERT INTO dados_familiares')) return { rows: [{ id: 'f1', paciente_id: 'p1' }] };
      return { rows: [] }; // BEGIN, COMMIT, ROLLBACK, UPDATE
    });
  }

  const comandosExecutados = () => mockClient.query.mock.calls.map((c) => String(c[0]));

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    simularTransacao();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PacientesTeaService, { provide: PG_POOL, useValue: mockPool }],
    }).compile();

    service = module.get<PacientesTeaService>(PacientesTeaService);
  });

  // ---------- CREATE ----------
describe('create', () => {
    beforeEach(() => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'triagem' }] }) // profissional da triagem existe
        .mockResolvedValueOnce({ rows: [] }); // CPF livre
    });

    it('considera apenas cadastros ativos ao verificar a duplicidade de CPF', async () => {
      await service.create(dtoCrianca as any);

      // a 2ª consulta ao pool é a verificação de CPF (a 1ª é a do profissional da triagem)
      expect(mockPool.query.mock.calls[1][0]).toContain('ativo = true');
    });

    it('cria cadastro de criança com responsável legal dentro de uma transação', async () => {
      const resultado = await service.create(dtoCrianca as any);

      expect(resultado.id).toBe('p1');
      expect(resultado.dados_familiares.id).toBe('f1');
      const comandos = comandosExecutados();
      expect(comandos[0]).toBe('BEGIN');
      expect(comandos[comandos.length - 1]).toBe('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('grava o CPF apenas com dígitos', async () => {
      await service.create(dtoCrianca as any);

      const insert = mockClient.query.mock.calls.find((c) =>
        String(c[0]).includes('INSERT INTO pacientes_tea'),
      );
      expect(insert?.[1]).toContain('11144477735');
    });

    it('ignora os dados do responsável legal quando a categoria é adulto', async () => {
      await service.create({ ...dtoCrianca, categoria: CategoriaEtaria.ADULTO } as any);

      const insert = mockClient.query.mock.calls.find((c) =>
        String(c[0]).includes('INSERT INTO dados_familiares'),
      );
      expect(insert?.[1]).not.toContain('Responsável Teste');
    });

    it('descarta a quantidade de filhos quando possuiFilhos é false', async () => {
      await service.create({
        ...dtoCrianca,
        dadosFamiliares: { ...dadosFamiliares, possuiFilhos: false, qtdMeninas: 3 },
      } as any);

      const insert = mockClient.query.mock.calls.find((c) =>
        String(c[0]).includes('INSERT INTO dados_familiares'),
      );
      expect(insert?.[1]).not.toContain(3);
    });

    it('faz ROLLBACK e libera a conexão quando algo falha no meio da transação', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO pacientes_tea')) return { rows: [{ id: 'p1' }] };
        if (sql.includes('INSERT INTO dados_familiares')) throw new Error('falha no banco');
        return { rows: [] };
      });

      await expect(service.create(dtoCrianca as any)).rejects.toThrow('falha no banco');

      expect(comandosExecutados()).toContain('ROLLBACK');
      expect(comandosExecutados()).not.toContain('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('converte violação de unicidade do banco (23505) em ConflictException', async () => {
      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO pacientes_tea')) {
          throw Object.assign(new Error('duplicate key'), { code: '23505' });
        }
        return { rows: [] };
      });

      await expect(service.create(dtoCrianca as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('create - validações antes de gravar', () => {
    it('lança ConflictException se o CPF já estiver cadastrado (RN1)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'triagem' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'existente' }] });

      await expect(service.create(dtoCrianca as any)).rejects.toThrow(ConflictException);
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('lança BadRequestException se o profissional da triagem não existir ou estiver inativo (RN6)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.create(dtoCrianca as any)).rejects.toThrow(BadRequestException);
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('lança BadRequestException para data de nascimento futura', async () => {
      await expect(
        service.create({ ...dtoCrianca, dataNascimento: '2999-01-01' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('lança BadRequestException se possuiFilhos é true sem informar quantidades', async () => {
      await expect(
        service.create({
          ...dtoCrianca,
          dadosFamiliares: { ...dadosFamiliares, possuiFilhos: true },
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------- FIND ALL ----------
  describe('findAll', () => {
    it('lista apenas cadastros ativos', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });

      const resultado = await service.findAll();

      expect(resultado).toHaveLength(1);
      expect(mockPool.query.mock.calls[0][0]).toContain('ativo = true');
    });

    it('retorna lista vazia quando não há cadastros', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      expect(await service.findAll()).toEqual([]);
    });

    it('filtra por CPF ignorando a pontuação', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.findAll({ cpf: '111.444.777-35' });

      expect(mockPool.query.mock.calls[0][0]).toContain('cpf = $1');
      expect(mockPool.query.mock.calls[0][1]).toEqual(['11144477735']);
    });

    it('filtra por nome com busca parcial e sem diferenciar maiúsculas', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.findAll({ nome: 'ana' });

      expect(mockPool.query.mock.calls[0][0]).toContain('ILIKE');
      expect(mockPool.query.mock.calls[0][1]).toEqual(['%ana%']);
    });

    it('filtra por número de cadastro e categoria ao mesmo tempo', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.findAll({ numeroCadastro: 5, categoria: CategoriaEtaria.IDOSO });

      expect(mockPool.query.mock.calls[0][0]).toContain('numero_cadastro = $1');
      expect(mockPool.query.mock.calls[0][0]).toContain('categoria = $2');
      expect(mockPool.query.mock.calls[0][1]).toEqual([5, CategoriaEtaria.IDOSO]);
    });
  });

  // ---------- FIND ONE ----------
  describe('findOne', () => {
    it('retorna o cadastro quando encontrado', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: '1', nome_completo: 'Fulano' }] });

      const resultado = await service.findOne('1');

      expect(resultado.id).toBe('1');
      expect(mockPool.query.mock.calls[0][0]).toContain('ativo = true');
    });

    it('lança NotFoundException se não existir (ou estiver removido)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.findOne('inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- UPDATE ----------
  describe('update', () => {
    it('lança NotFoundException ao atualizar cadastro inexistente', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.update('x', { nivelSuporte: 3 } as any)).rejects.toThrow(NotFoundException);
    });

    it('atualiza apenas os campos enviados', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: '1', categoria: 'crianca' }] }) // findOne inicial
        .mockResolvedValueOnce({ rows: [{ id: '1', nivel_suporte: 3 }] }); // findOne final

      const resultado = await service.update('1', { nivelSuporte: 3 } as any);

      const updates = comandosExecutados().filter((sql) => sql.startsWith('UPDATE'));
      expect(updates).toHaveLength(1);
      expect(updates[0]).toContain('UPDATE pacientes_tea');
      expect(updates[0]).toContain('nivel_suporte = $1');
      expect(resultado.nivel_suporte).toBe(3);
    });

    it('não abre transação quando não há nada para atualizar', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: '1', categoria: 'crianca' }] });

      const resultado = await service.update('1', {} as any);

      expect(resultado.id).toBe('1');
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('limpa o nome da instituição quando passa a não frequentar escola', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: '1', categoria: 'crianca' }] })
        .mockResolvedValueOnce({ rows: [{ id: '1' }] });

      await service.update('1', { frequentaEscola: false } as any);

      const upd = mockClient.query.mock.calls.find((c) => String(c[0]).startsWith('UPDATE pacientes_tea'));
      expect(upd?.[0]).toContain('nome_instituicao = $');
      expect(upd?.[1]).toContain(null);
    });

    it('zera os dados do responsável legal quando a categoria passa a ser adulto', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: '1', categoria: 'adolescente' }] })
        .mockResolvedValueOnce({ rows: [{ id: '1' }] });

      await service.update('1', { categoria: CategoriaEtaria.ADULTO } as any);

      const upd = mockClient.query.mock.calls.find((c) => String(c[0]).startsWith('UPDATE dados_familiares'));
      expect(upd?.[0]).toContain('responsavel_nome = $');
      expect(upd?.[1]).toEqual([null, null, null, null, '1']);
    });

    it('lança ConflictException se o novo CPF já pertence a outro cadastro (RN1)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: '1', categoria: 'crianca' }] })
        .mockResolvedValueOnce({ rows: [{ id: '2' }] });

      await expect(service.update('1', { cpf: '52998224725' } as any)).rejects.toThrow(ConflictException);
    });

    it('lança BadRequestException para data de nascimento futura', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: '1', categoria: 'crianca' }] });

      await expect(service.update('1', { dataNascimento: '2999-01-01' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------- REMOVE ----------
  describe('remove', () => {
    it('faz remoção lógica (ativo = false) sem apagar a linha', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: '1' }] }) // findOne
        .mockResolvedValueOnce({ rows: [] }); // update

      const resultado = await service.remove('1');

      expect(resultado.message).toContain('sucesso');
      expect(mockPool.query.mock.calls[1][0]).toContain('ativo = false');
      expect(mockPool.query.mock.calls[1][0]).not.toContain('DELETE');
    });

    it('lança NotFoundException ao remover cadastro inexistente', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.remove('x')).rejects.toThrow(NotFoundException);
    });
  });
});
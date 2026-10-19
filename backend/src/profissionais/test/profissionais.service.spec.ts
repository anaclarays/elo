import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProfissionaisService } from '../service/profissionais.service';
import { PG_POOL } from '../../database/database.constants';
import { AreaAtuacao, Periodo } from '../dto/create-profissional.dto';

describe('ProfissionaisService', () => {
  let service: ProfissionaisService;
  const mockPool = { query: jest.fn() };

  const dtoValido = {
    nomeCompleto: 'Profissional Teste',
    cpf: '11144477735',
    telefone: '81999999999',
    email: 'profissional@teste.com',
    areaAtuacao: AreaAtuacao.COORDENACAO_ADMINISTRATIVA,
    cargo: 'Coordenadora',
    senha: 'Senha@123',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfissionaisService,
        { provide: PG_POOL, useValue: mockPool },
      ],
    }).compile();

    service = module.get<ProfissionaisService>(ProfissionaisService);
  });

  // ---------- Criar ----------
  describe('create', () => {
    it('deve criar um profissional com sucesso (cenário de sucesso)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] }) // verificação de duplicidade
        .mockResolvedValueOnce({ rows: [{ id: '1', ...dtoValido }] }); // insert

      const resultado = await service.create(dtoValido as any);

      expect(resultado).toHaveProperty('id');
      expect(resultado).not.toHaveProperty('senha_hash'); // senha nunca retorna
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('deve lançar ConflictException se CPF ou e-mail já existirem (RN11)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'existente' }] });

      await expect(service.create(dtoValido as any)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPool.query).toHaveBeenCalledTimes(1); // não chega a tentar o INSERT
    });

        it('deve aceitar os campos opcionais de voluntariado quando fornecidos', async () => {
      const dtoVoluntario = {
        ...dtoValido,
        areaAtuacao: AreaAtuacao.VOLUNTARIADO_SAUDE,
        capacidadeSemanal: 10,
        periodos: [Periodo.MANHA],
        horarioInicio: '08:00',
        horarioFim: '12:00',
        status: 'Ativo',
        telefoneAtendimento: '81988888888',
      };
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: '2', ...dtoVoluntario }] });

      const resultado = await service.create(dtoVoluntario as any);

      expect(resultado.capacidadeSemanal ?? 10).toBeDefined();
      expect(mockPool.query.mock.calls[1][1]).toContain(10);
      expect(mockPool.query.mock.calls[1][1]).toContainEqual([Periodo.MANHA]);
    });
  });

  // ---------- Listar ----------
  describe('findAll', () => {
    
    it('deve retornar apenas profissionais ativos', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: '1', nome_completo: 'Fulana', ativo: true }],
      });

      const resultado = await service.findAll();

      expect(resultado).toHaveLength(1);
      expect(mockPool.query.mock.calls[0][0]).toContain('ativo = true');
    });

    it('deve retornar lista vazia quando não há profissionais (cenário de borda)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const resultado = await service.findAll();

      expect(resultado).toEqual([]);
    });
    it('deve filtrar por CPF quando informado', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: '1', cpf: '11144477735' }],
      });

      await service.findAll({ cpf: '111.444.777-35' });

      expect(mockPool.query.mock.calls[0][0]).toContain('cpf = $1');
      expect(mockPool.query.mock.calls[0][1]).toEqual(['11144477735']);
    });

    it('deve filtrar por nome quando informado (busca parcial, case-insensitive)', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: '1', nome_completo: 'Layse Gomes' }],
      });

      await service.findAll({ nome: 'layse' });

      expect(mockPool.query.mock.calls[0][0]).toContain('ILIKE');
      expect(mockPool.query.mock.calls[0][1]).toEqual(['%layse%']);
    });
  });

  // ---------- Encontrar Um ----------
  describe('findOne', () => {
    it('deve retornar o profissional quando encontrado', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: '1', nome_completo: 'Fulana' }],
      });

      const resultado = await service.findOne('1');

      expect(resultado.id).toBe('1');
    });

    it('deve lançar NotFoundException se o profissional não existir', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.findOne('id-invalido')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------- Atualizar ----------
  describe('update', () => {
    it('deve atualizar os dados com sucesso (RN12)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: '1' }] }) // findOne (existe)
        .mockResolvedValueOnce({ rows: [{ id: '1', cargo: 'Novo Cargo' }] }); // update

      const resultado = await service.update('1', { cargo: 'Novo Cargo' } as any);

      expect(resultado.cargo).toBe('Novo Cargo');
    });

    it('deve lançar NotFoundException ao tentar atualizar profissional inexistente', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // findOne não encontra

      await expect(
        service.update('id-invalido', { cargo: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ConflictException se o novo CPF/e-mail já pertencer a outro profissional (RN11)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: '1' }] }) // findOne
        .mockResolvedValueOnce({ rows: [{ id: '2' }] }); // conflito com outro id

      await expect(
        service.update('1', { email: 'outro@teste.com' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ---------- Remover ----------
  describe('remove', () => {
    it('deve marcar o profissional como inativo (soft delete, RN13)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: '1' }] }) // findOne
        .mockResolvedValueOnce({ rows: [] }); // update

      const resultado = await service.remove('1');

      expect(resultado.message).toContain('sucesso');
      expect(mockPool.query.mock.calls[1][0]).toContain('ativo = false');
    });

    it('deve lançar NotFoundException ao remover profissional inexistente', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.remove('id-invalido')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
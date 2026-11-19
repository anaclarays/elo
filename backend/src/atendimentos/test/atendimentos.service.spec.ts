import { jest } from '@jest/globals';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AtendimentosService } from '../service/atendimentos.service';
import {
  AtendimentoRecord,
  AtendimentosRepository,
} from '../atendimentos.repository';
import {
  CreateAtendimentoDto,
  TipoAtendimento,
} from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';
import { ProfissionaisService } from '../../profissionais/service/profissionais.service';

describe('AtendimentosService', () => {
  let service: AtendimentosService;

  const repository = {
    create:
      jest.fn<(dto: CreateAtendimentoDto) => Promise<AtendimentoRecord>>(),
    findAll: jest.fn<() => Promise<AtendimentoRecord[]>>(),
    findOne: jest.fn<(id: number) => Promise<AtendimentoRecord | null>>(),
    update:
      jest.fn<
        (
          id: number,
          dto: UpdateAtendimentoDto,
        ) => Promise<AtendimentoRecord | null>
      >(),
    remove: jest.fn<(id: number) => Promise<boolean>>(),
    hasTimeConflict:
      jest.fn<
        (
          outroId: number | string,
          dataInicio: Date,
          pessoa: string,
        ) => Promise<boolean>
      >(),
  };

  const profissionaisService = {
    findOne:
      jest.fn<
        (id: string) => Promise<{ horario_inicio: string; horario_fim: string }>
      >(),
  };

  const dataInicio = new Date('2026-10-29T13:00:00.000Z');

  const createDto: CreateAtendimentoDto = {
    pacienteId: 23,
    profissionalId: '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
    dataInicio,
    tipo: TipoAtendimento.PSICOLOGIA,
  };

  const atendimento: AtendimentoRecord = {
    id: 1,
    ...createDto,
    dataFim: new Date(dataInicio.getTime() + 20 * 60000),
  };

  beforeEach(async () => {
    service = new AtendimentosService(
      repository as unknown as AtendimentosRepository,
      profissionaisService as unknown as ProfissionaisService,
    );

    jest.clearAllMocks();

    profissionaisService.findOne.mockResolvedValue({
      horario_inicio: '08:00',
      horario_fim: '17:00',
    });

    repository.hasTimeConflict.mockResolvedValue(false);
  });

  describe('create', () => {
    it('valida o horário e cria o atendimento', async () => {
      repository.create.mockResolvedValue(atendimento);

      await expect(service.create(createDto)).resolves.toBe(atendimento);

      expect(profissionaisService.findOne).toHaveBeenCalledWith(
        createDto.profissionalId,
      );
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        1,
        createDto.profissionalId,
        dataInicio,
        'profissional',
      );
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        2,
        createDto.pacienteId,
        dataInicio,
        'paciente',
      );
      expect(repository.create).toHaveBeenCalledWith(createDto);
    });

    it('propaga falhas ao buscar o profissional', async () => {
      const error = new Error('profissional indisponível');
      profissionaisService.findOne.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toBe(error);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita horário fora da disponibilidade do profissional', async () => {
      profissionaisService.findOne.mockResolvedValue({
        horario_inicio: '10:00',
        horario_fim: '10:10',
      });

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.hasTimeConflict).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita horário conflitante com outro atendimento do profissional', async () => {
      repository.hasTimeConflict.mockResolvedValueOnce(true);

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.hasTimeConflict).toHaveBeenCalledTimes(1);
      expect(repository.hasTimeConflict).toHaveBeenCalledWith(
        createDto.profissionalId,
        dataInicio,
        'profissional',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita horário conflitante com outro atendimento do paciente', async () => {
      repository.hasTimeConflict
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.hasTimeConflict).toHaveBeenCalledTimes(2);
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        2,
        createDto.pacienteId,
        dataInicio,
        'paciente',
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('propaga falhas ao criar o atendimento no repositório', async () => {
      const error = new Error('falha de persistência');
      repository.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toBe(error);
    });
  });

  describe('findAll', () => {
    it('retorna a lista de atendimentos', async () => {
      const atendimentos = [atendimento];
      repository.findAll.mockResolvedValue(atendimentos);

      await expect(service.findAll()).resolves.toBe(atendimentos);
      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });

    it('propaga falhas ao listar atendimentos', async () => {
      const error = new Error('falha de persistência');
      repository.findAll.mockRejectedValue(error);

      await expect(service.findAll()).rejects.toBe(error);
    });
  });

  describe('findOne', () => {
    it('retorna o atendimento encontrado', async () => {
      repository.findOne.mockResolvedValue(atendimento);

      await expect(service.findOne(1)).resolves.toBe(atendimento);
      expect(repository.findOne).toHaveBeenCalledWith(1);
    });

    it('lança NotFoundException quando o atendimento não existe', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(23)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.findOne).toHaveBeenCalledWith(23);
    });

    it('propaga falhas ao buscar o atendimento', async () => {
      const error = new Error('falha de persistência');
      repository.findOne.mockRejectedValue(error);

      await expect(service.findOne(1)).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('atualiza o atendimento sem revalidar um horário que não mudou', async () => {
      const updateDto: UpdateAtendimentoDto = {
        tipo: TipoAtendimento.PEDAGOGIA,
      };
      const atendimentoAtualizado = {
        ...atendimento,
        ...updateDto,
      };

      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockResolvedValue(atendimentoAtualizado);

      await expect(service.update(1, updateDto)).resolves.toBe(
        atendimentoAtualizado,
      );

      expect(repository.update).toHaveBeenCalledWith(1, atendimentoAtualizado);
      expect(profissionaisService.findOne).not.toHaveBeenCalled();
      expect(repository.hasTimeConflict).not.toHaveBeenCalled();
    });

    it('revalida o horário quando a data de início é alterada', async () => {
      const novaDataInicio = new Date('2026-10-29T14:00:00.000Z');
      const updateDto: UpdateAtendimentoDto = {
        dataInicio: novaDataInicio,
      };
      const atendimentoAtualizado = {
        ...atendimento,
        ...updateDto,
      };

      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockResolvedValue(atendimentoAtualizado);

      await expect(service.update(1, updateDto)).resolves.toBe(
        atendimentoAtualizado,
      );

      expect(profissionaisService.findOne).toHaveBeenCalledWith(
        atendimento.profissionalId,
      );
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        1,
        atendimento.profissionalId,
        novaDataInicio,
        'profissional',
      );
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        2,
        atendimento.pacienteId,
        novaDataInicio,
        'paciente',
      );
      expect(repository.update).toHaveBeenCalledWith(1, atendimentoAtualizado);
    });

    it('rejeita uma atualização vazia', async () => {
      await expect(service.update(1, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o atendimento a atualizar não existe', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update(23, { tipo: TipoAtendimento.PEDAGOGIA }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejeita uma nova data fora da disponibilidade do profissional', async () => {
      const novaDataInicio = new Date('2026-10-29T14:00:00.000Z');
      repository.findOne.mockResolvedValue(atendimento);
      profissionaisService.findOne.mockResolvedValue({
        horario_inicio: '10:00',
        horario_fim: '10:10',
      });

      await expect(
        service.update(1, { dataInicio: novaDataInicio }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repository.update).not.toHaveBeenCalled();
      expect(repository.hasTimeConflict).not.toHaveBeenCalled();
    });

    it('rejeita nova data conflitante com outro atendimento do profissional', async () => {
      const novaDataInicio = new Date('2026-10-29T14:00:00.000Z');
      repository.findOne.mockResolvedValue(atendimento);
      repository.hasTimeConflict.mockResolvedValueOnce(true);

      await expect(
        service.update(1, { dataInicio: novaDataInicio }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repository.hasTimeConflict).toHaveBeenCalledTimes(1);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejeita nova data conflitante com outro atendimento do paciente', async () => {
      const novaDataInicio = new Date('2026-10-29T14:00:00.000Z');
      repository.findOne.mockResolvedValue(atendimento);
      repository.hasTimeConflict
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        service.update(1, { dataInicio: novaDataInicio }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repository.hasTimeConflict).toHaveBeenCalledTimes(2);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('retorna null quando o repositório não retorna o atendimento atualizado', async () => {
      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockResolvedValue(null);

      await expect(
        service.update(1, { tipo: TipoAtendimento.PEDAGOGIA }),
      ).resolves.toBeNull();
    });
    
    it('propaga falhas ao atualizar o atendimento no repositório', async () => {
      const error = new Error('falha de persistência');
      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockRejectedValue(error);

      await expect(
        service.update(1, { tipo: TipoAtendimento.PEDAGOGIA }),
      ).rejects.toBe(error);
    });
  });

  describe('remove', () => {
    it('remove o atendimento existente', async () => {
      repository.remove.mockResolvedValue(true);

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(repository.remove).toHaveBeenCalledWith(1);
    });

    it('lança NotFoundException quando o atendimento a remover não existe', async () => {
      repository.remove.mockResolvedValue(false);

      await expect(service.remove(23)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.remove).toHaveBeenCalledWith(23);
    });

    it('propaga falhas ao remover o atendimento', async () => {
      const error = new Error('falha de persistência');
      repository.remove.mockRejectedValue(error);

      await expect(service.remove(1)).rejects.toBe(error);
    });
  })
});

import { jest } from '@jest/globals';
import { AtendimentosController } from '../controller/atendimentos.controller';
import { AtendimentosService } from '../service/atendimentos.service';
import {
  CreateAtendimentoDto,
  TipoAtendimento,
} from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';
import { AtendimentoRecord } from '../atendimentos.repository';

describe('AtendimentosController', () => {
  let controller: AtendimentosController;

  const atendimentosService = {
    create:
      jest.fn<(dto: CreateAtendimentoDto) => Promise<AtendimentoRecord>>(),
    findAll: jest.fn<() => Promise<AtendimentoRecord[]>>(),
    findOne: jest.fn<(id: number) => Promise<AtendimentoRecord>>(),
    update:
      jest.fn<
        (
          id: number,
          dto: UpdateAtendimentoDto,
        ) => Promise<AtendimentoRecord | null>
      >(),
    remove: jest.fn<(id: number) => Promise<void>>(),
  };

  const dataInicio = new Date('2026-10-29T13:00:00.000Z');

  const createDto: CreateAtendimentoDto = {
    pacienteId: 23,
    profissionalId: '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
    dataInicio,
    tipo: TipoAtendimento.PSICOLOGIA,
  };

  const updateDto: UpdateAtendimentoDto = {
    tipo: TipoAtendimento.TERAPIA_OCUPACIONAL,
  };

  const atendimento: AtendimentoRecord = {
    id: 1,
    ...createDto,
    dataFim: new Date(dataInicio.getTime() + 20 * 60000),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    controller = new AtendimentosController(
      atendimentosService as unknown as AtendimentosService,
    );
  });

  describe('create', () => {
    it('cria e retorna o atendimento', async () => {
      atendimentosService.create.mockResolvedValue(atendimento);

      await expect(controller.create(createDto)).resolves.toBe(atendimento);
      expect(atendimentosService.create).toHaveBeenCalledWith(createDto);
    });

    it('propaga falhas ao criar o atendimento', async () => {
      const error = new Error('falha ao criar atendimento');
      atendimentosService.create.mockRejectedValue(error);

      await expect(controller.create(createDto)).rejects.toBe(error);
      expect(atendimentosService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('retorna a lista de atendimentos', async () => {
      const atendimentos = [atendimento];
      atendimentosService.findAll.mockResolvedValue(atendimentos);

      await expect(controller.findAll()).resolves.toBe(atendimentos);
      expect(atendimentosService.findAll).toHaveBeenCalledTimes(1);
    });

    it('propaga falhas ao listar atendimentos', async () => {
      const error = new Error('falha ao listar atendimentos');
      atendimentosService.findAll.mockRejectedValue(error);

      await expect(controller.findAll()).rejects.toBe(error);
      expect(atendimentosService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('retorna o atendimento correspondente ao id', async () => {
      atendimentosService.findOne.mockResolvedValue(atendimento);

      await expect(controller.findOne(1)).resolves.toBe(atendimento);
      expect(atendimentosService.findOne).toHaveBeenCalledWith(1);
    });

    it('propaga falhas ao buscar o atendimento', async () => {
      const error = new Error('atendimento não encontrado');
      atendimentosService.findOne.mockRejectedValue(error);

      await expect(controller.findOne(1)).rejects.toBe(error);
      expect(atendimentosService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    it('atualiza e retorna o atendimento', async () => {
      const atendimentoAtualizado = { ...atendimento, ...updateDto };
      atendimentosService.update.mockResolvedValue(atendimentoAtualizado);

      await expect(controller.update(1, updateDto)).resolves.toBe(
        atendimentoAtualizado,
      );
      expect(atendimentosService.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('propaga falhas ao atualizar o atendimento', async () => {
      const error = new Error('falha ao atualizar atendimento');
      atendimentosService.update.mockRejectedValue(error);

      await expect(controller.update(1, updateDto)).rejects.toBe(error);
      expect(atendimentosService.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('replace', () => {
    it('substitui e retorna o atendimento', async () => {
      const atendimentoSubstituido = { ...atendimento, ...updateDto };
      atendimentosService.update.mockResolvedValue(atendimentoSubstituido);

      await expect(controller.replace(1, updateDto)).resolves.toBe(
        atendimentoSubstituido,
      );
      expect(atendimentosService.update).toHaveBeenCalledWith(1, updateDto);
    });

    it('propaga falhas ao substituir o atendimento', async () => {
      const error = new Error('falha ao substituir atendimento');
      atendimentosService.update.mockRejectedValue(error);

      await expect(controller.replace(1, updateDto)).rejects.toBe(error);
      expect(atendimentosService.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('remove', () => {
    it('remove o atendimento', async () => {
      atendimentosService.remove.mockResolvedValue(undefined);

      await expect(controller.remove(1)).resolves.toBeUndefined();
      expect(atendimentosService.remove).toHaveBeenCalledWith(1);
    });

    it('propaga falhas ao remover o atendimento', async () => {
      const error = new Error('falha ao remover atendimento');
      atendimentosService.remove.mockRejectedValue(error);

      await expect(controller.remove(1)).rejects.toBe(error);
      expect(atendimentosService.remove).toHaveBeenCalledWith(1);
    });
  });
});

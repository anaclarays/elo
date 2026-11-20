import { jest } from '@jest/globals';
import { AtendimentosController } from '../controller/atendimentos.controller';
import { AtendimentosService } from '../service/atendimentos.service';
import {
  CreateAtendimentoDto,
  StatusAtendimento,
  TipoAtendimento,
} from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';
import { AtendimentoRecord } from '../atendimentos.repository';

describe('AtendimentosController', () => {
  let controller: AtendimentosController;

  const atendimentosService = {
    create:
      jest.fn<(dto: CreateAtendimentoDto) => Promise<AtendimentoRecord>>(),
    findAll:
      jest.fn<(status?: StatusAtendimento) => Promise<AtendimentoRecord[]>>(),
    findOne: jest.fn<(id: string) => Promise<AtendimentoRecord>>(),
    update:
      jest.fn<
        (
          id: string,
          dto: UpdateAtendimentoDto,
        ) => Promise<AtendimentoRecord | null>
      >(),
    cancel:
      jest.fn<(id: string, motivo?: string) => Promise<AtendimentoRecord>>(),
  };

  const atendimentoId = 'e695038b-6355-4db4-b833-48f5062a3aab';
  const pacienteTeaId = '7a63fc53-ea95-4cd7-8a59-dd45d807d696';
  const dataInicio = new Date('2030-10-29T13:00:00.000Z');

  const createDto: CreateAtendimentoDto = {
    pacienteId: '23',
    isTea: false,
    profissionalId: pacienteTeaId,
    dataInicio,
    tipo: TipoAtendimento.PSICOLOGIA,
  };

  const createTeaDto: CreateAtendimentoDto = {
    ...createDto,
    pacienteId: pacienteTeaId,
    isTea: true,
  };

  const updateDto: UpdateAtendimentoDto = {
    tipo: TipoAtendimento.TERAPIA_OCUPACIONAL,
  };

  const updateTeaDto: UpdateAtendimentoDto = {
    pacienteId: pacienteTeaId,
    isTea: true,
  };

  const atendimento: AtendimentoRecord = {
    id: atendimentoId,
    ...createDto,
    dataFim: new Date(dataInicio.getTime() + 20 * 60000),
    status: StatusAtendimento.AGENDADO,
    canceladoEm: null,
    motivoCancelamento: null,
  };

  const atendimentoTea: AtendimentoRecord = {
    ...atendimento,
    ...createTeaDto,
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

    it('cria e retorna um atendimento de paciente TEA', async () => {
      atendimentosService.create.mockResolvedValue(atendimentoTea);

      await expect(controller.create(createTeaDto)).resolves.toBe(
        atendimentoTea,
      );
      expect(atendimentosService.create).toHaveBeenCalledWith(createTeaDto);
    });

    it('propaga falhas ao criar um atendimento de paciente TEA', async () => {
      const error = new Error('falha ao criar atendimento de paciente TEA');
      atendimentosService.create.mockRejectedValue(error);

      await expect(controller.create(createTeaDto)).rejects.toBe(error);
      expect(atendimentosService.create).toHaveBeenCalledWith(createTeaDto);
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

      await expect(controller.findOne(atendimentoId)).resolves.toBe(
        atendimento,
      );
      expect(atendimentosService.findOne).toHaveBeenCalledWith(atendimentoId);
    });

    it('propaga falhas ao buscar o atendimento', async () => {
      const error = new Error('atendimento não encontrado');
      atendimentosService.findOne.mockRejectedValue(error);

      await expect(controller.findOne(atendimentoId)).rejects.toBe(error);
      expect(atendimentosService.findOne).toHaveBeenCalledWith(atendimentoId);
    });
  });

  describe('update', () => {
    it('atualiza e retorna o atendimento', async () => {
      const atendimentoAtualizado = { ...atendimento, ...updateDto };
      atendimentosService.update.mockResolvedValue(atendimentoAtualizado);

      await expect(controller.update(atendimentoId, updateDto)).resolves.toBe(
        atendimentoAtualizado,
      );
      expect(atendimentosService.update).toHaveBeenCalledWith(
        atendimentoId,
        updateDto,
      );
    });

    it('propaga falhas ao atualizar o atendimento', async () => {
      const error = new Error('falha ao atualizar atendimento');
      atendimentosService.update.mockRejectedValue(error);

      await expect(controller.update(atendimentoId, updateDto)).rejects.toBe(
        error,
      );
      expect(atendimentosService.update).toHaveBeenCalledWith(
        atendimentoId,
        updateDto,
      );
    });

    it('encaminha a atualização de paciente TEA ao service', async () => {
      atendimentosService.update.mockResolvedValue(atendimentoTea);

      await expect(
        controller.update(atendimentoId, updateTeaDto),
      ).resolves.toBe(atendimentoTea);
      expect(atendimentosService.update).toHaveBeenCalledWith(
        atendimentoId,
        updateTeaDto,
      );
    });

    it('propaga falhas ao atualizar um atendimento de paciente TEA', async () => {
      const error = new Error('falha ao atualizar paciente TEA');
      atendimentosService.update.mockRejectedValue(error);

      await expect(controller.update(atendimentoId, updateTeaDto)).rejects.toBe(
        error,
      );
      expect(atendimentosService.update).toHaveBeenCalledWith(
        atendimentoId,
        updateTeaDto,
      );
    });
  });

  describe('cancel', () => {
    it('cancela o atendimento repassando o motivo', async () => {
      const cancelado: AtendimentoRecord = {
        ...atendimento,
        status: StatusAtendimento.CANCELADO,
        canceladoEm: new Date('2030-10-28T12:00:00.000Z'),
        motivoCancelamento: 'Paciente viajou',
      };
      atendimentosService.cancel.mockResolvedValue(cancelado);

      await expect(
        controller.cancel(atendimentoId, { motivo: 'Paciente viajou' }),
      ).resolves.toBe(cancelado);
      expect(atendimentosService.cancel).toHaveBeenCalledWith(
        atendimentoId,
        'Paciente viajou',
      );
    });

    it('propaga falhas ao cancelar o atendimento', async () => {
      const error = new Error('falha ao cancelar atendimento');
      atendimentosService.cancel.mockRejectedValue(error);

      await expect(controller.cancel(atendimentoId, {})).rejects.toBe(error);
    });
  });

  it('repassa o filtro de status na listagem', async () => {
    atendimentosService.findAll.mockResolvedValue([]);

    await controller.findAll(StatusAtendimento.CANCELADO);

    expect(atendimentosService.findAll).toHaveBeenCalledWith(
      StatusAtendimento.CANCELADO,
    );
  });
});

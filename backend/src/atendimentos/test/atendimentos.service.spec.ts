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
  StatusAtendimento,
  TipoAtendimento,
} from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';
import { ProfissionaisService } from '../../profissionais/service/profissionais.service';
import {
  PacienteRef,
  TipoPaciente,
} from '../../lista-espera/enum/lista-espera.enum';
import { ListaEsperaService } from '../../lista-espera/service/lista-espera.service';

describe('AtendimentosService', () => {
  let service: AtendimentosService;

  const repository = {
    create:
      jest.fn<(dto: CreateAtendimentoDto) => Promise<AtendimentoRecord>>(),
    findAll:
      jest.fn<(status?: StatusAtendimento) => Promise<AtendimentoRecord[]>>(),
    findOne: jest.fn<(id: string) => Promise<AtendimentoRecord | null>>(),
    update:
      jest.fn<
        (
          id: string,
          dto: CreateAtendimentoDto,
        ) => Promise<AtendimentoRecord | null>
      >(),
    cancel:
      jest.fn<
        (id: string, motivo?: string) => Promise<AtendimentoRecord | null>
      >(),
    hasTimeConflict:
      jest.fn<
        (
          outroId: number | string,
          dataInicio: Date,
          pessoa: string,
          ignorarAtendimentoId?: string,
        ) => Promise<boolean>
      >(),
    isPacienteAtivo:
      jest.fn<
        (pacienteId: number | string, isTea: boolean) => Promise<boolean>
      >(),
    emTransacao:
      jest.fn<
        (operacao: (client: unknown) => Promise<unknown>) => Promise<unknown>
      >(),
  };

  const client = { query: jest.fn() };

  const listaEsperaService = {
    retirarPorAgendamento:
      jest.fn<
        (paciente: PacienteRef, executor?: unknown) => Promise<boolean>
      >(),
  };

  const profissionaisService = {
    findOne: jest.fn<
      (id: string) => Promise<{
        horario_inicio: string | null;
        horario_fim: string | null;
        ativo?: boolean;
      }>
    >(),
  };

  const atendimentoId = 'e695038b-6355-4db4-b833-48f5062a3aab';
  const pacienteId = '23';
  const pacienteTeaId = '7a63fc53-ea95-4cd7-8a59-dd45d807d696';
  const dataInicio = new Date('2030-10-29T13:00:00.000Z');

  const createDto: CreateAtendimentoDto = {
    pacienteId,
    isTea: false,
    profissionalId: pacienteTeaId,
    dataInicio,
    tipo: TipoAtendimento.PSICOLOGIA,
  };

  const atendimento: AtendimentoRecord = {
    id: atendimentoId,
    ...createDto,
    dataFim: new Date(dataInicio.getTime() + 20 * 60000),
    status: StatusAtendimento.AGENDADO,
    canceladoEm: null,
    motivoCancelamento: null,
  };

  beforeEach(async () => {
    service = new AtendimentosService(
      repository as unknown as AtendimentosRepository,
      profissionaisService as unknown as ProfissionaisService,
      listaEsperaService as unknown as ListaEsperaService,
    );

    jest.clearAllMocks();

    repository.emTransacao.mockImplementation((operacao) => operacao(client));
    listaEsperaService.retirarPorAgendamento.mockResolvedValue(true);

    profissionaisService.findOne.mockResolvedValue({
      horario_inicio: '08:00',
      horario_fim: '17:00',
    });

    repository.hasTimeConflict.mockResolvedValue(false);
    repository.isPacienteAtivo.mockResolvedValue(true);
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
        undefined,
      );
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        2,
        createDto.pacienteId,
        dataInicio,
        'paciente',
        undefined,
      );
      expect(repository.create).toHaveBeenCalledWith(createDto, client);
    });

    it('retira o paciente da lista de espera na mesma transação do agendamento', async () => {
      repository.create.mockResolvedValue(atendimento);

      await service.create(createDto);

      expect(repository.emTransacao).toHaveBeenCalledTimes(1);
      expect(listaEsperaService.retirarPorAgendamento).toHaveBeenCalledWith(
        { tipo: TipoPaciente.BENEFICIARIO, id: pacienteId },
        client,
      );
    });

    it('propaga a falha ao retirar da lista de espera, para a transação ser desfeita', async () => {
      const error = new Error('falha na lista de espera');
      repository.create.mockResolvedValue(atendimento);
      listaEsperaService.retirarPorAgendamento.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toBe(error);
    });

    it('não abre transação nem mexe na lista de espera quando a validação falha', async () => {
      repository.isPacienteAtivo.mockResolvedValue(false);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );

      expect(repository.emTransacao).not.toHaveBeenCalled();
      expect(listaEsperaService.retirarPorAgendamento).not.toHaveBeenCalled();
    });

    it('valida o horário e cria um atendimento de paciente TEA', async () => {
      const createTeaDto: CreateAtendimentoDto = {
        ...createDto,
        pacienteId: pacienteTeaId,
        isTea: true,
      };
      const atendimentoTea: AtendimentoRecord = {
        ...atendimento,
        ...createTeaDto,
      };
      repository.create.mockResolvedValue(atendimentoTea);

      await expect(service.create(createTeaDto)).resolves.toBe(atendimentoTea);

      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        2,
        pacienteTeaId,
        dataInicio,
        'paciente_tea',
        undefined,
      );
      expect(repository.create).toHaveBeenCalledWith(createTeaDto, client);
      expect(listaEsperaService.retirarPorAgendamento).toHaveBeenCalledWith(
        { tipo: TipoPaciente.TEA, id: pacienteTeaId },
        client,
      );
    });

    it('propaga falhas ao buscar o profissional', async () => {
      const error = new Error('profissional indisponível');
      profissionaisService.findOne.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toBe(error);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita horário conflitante com outro atendimento do paciente TEA', async () => {
      const createTeaDto: CreateAtendimentoDto = {
        ...createDto,
        pacienteId: pacienteTeaId,
        isTea: true,
      };
      repository.hasTimeConflict
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(service.create(createTeaDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        2,
        pacienteTeaId,
        dataInicio,
        'paciente_tea',
        undefined,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita uma data de atendimento no passado', async () => {
      await expect(
        service.create({
          ...createDto,
          dataInicio: new Date('2000-01-01T13:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.hasTimeConflict).not.toHaveBeenCalled();
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
      expect(repository.hasTimeConflict).toHaveBeenCalledTimes(2);
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
        undefined,
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
        undefined,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita profissional inativo', async () => {
      profissionaisService.findOne.mockResolvedValue({
        horario_inicio: '08:00',
        horario_fim: '17:00',
        ativo: false,
      });

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita profissional sem horário de atendimento cadastrado', async () => {
      profissionaisService.findOne.mockResolvedValue({
        horario_inicio: null,
        horario_fim: null,
      });

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejeita paciente inexistente ou inativo', async () => {
      repository.isPacienteAtivo.mockResolvedValue(false);

      await expect(service.create(createDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.isPacienteAtivo).toHaveBeenCalledWith(
        createDto.pacienteId,
        false,
      );
      expect(repository.hasTimeConflict).not.toHaveBeenCalled();
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

      await expect(service.findOne(atendimentoId)).resolves.toBe(atendimento);
      expect(repository.findOne).toHaveBeenCalledWith(atendimentoId);
    });

    it('lança NotFoundException quando o atendimento não existe', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(atendimentoId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.findOne).toHaveBeenCalledWith(atendimentoId);
    });

    it('propaga falhas ao buscar o atendimento', async () => {
      const error = new Error('falha de persistência');
      repository.findOne.mockRejectedValue(error);

      await expect(service.findOne(atendimentoId)).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('atualiza o atendimento sem revalidar um horário que não mudou', async () => {
      const updateDto: UpdateAtendimentoDto = {
        tipo: TipoAtendimento.PEDAGOGIA,
      };
      const atendimentoAtualizado: CreateAtendimentoDto = {
        ...createDto,
        ...updateDto,
      };
      const registroAtualizado: AtendimentoRecord = {
        ...atendimento,
        ...atendimentoAtualizado,
      };

      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockResolvedValue(registroAtualizado);

      await expect(service.update(atendimentoId, updateDto)).resolves.toBe(
        registroAtualizado,
      );

      expect(repository.update).toHaveBeenCalledWith(
        atendimentoId,
        atendimentoAtualizado,
      );
      expect(profissionaisService.findOne).not.toHaveBeenCalled();
      expect(repository.hasTimeConflict).not.toHaveBeenCalled();
      expect(repository.emTransacao).not.toHaveBeenCalled();
      expect(listaEsperaService.retirarPorAgendamento).not.toHaveBeenCalled();
    });

    it('revalida o horário quando a data de início é alterada', async () => {
      const novaDataInicio = new Date('2030-10-29T14:00:00.000Z');
      const updateDto: UpdateAtendimentoDto = {
        dataInicio: novaDataInicio,
      };
      const atendimentoAtualizado: CreateAtendimentoDto = {
        ...createDto,
        ...updateDto,
      };
      const registroAtualizado: AtendimentoRecord = {
        ...atendimento,
        ...atendimentoAtualizado,
      };

      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockResolvedValue(registroAtualizado);

      await expect(service.update(atendimentoId, updateDto)).resolves.toBe(
        registroAtualizado,
      );

      expect(profissionaisService.findOne).toHaveBeenCalledWith(
        atendimento.profissionalId,
      );
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        1,
        atendimento.profissionalId,
        novaDataInicio,
        'profissional',
        atendimentoId,
      );
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        2,
        atendimento.pacienteId,
        novaDataInicio,
        'paciente',
        atendimentoId,
      );
      expect(repository.update).toHaveBeenCalledWith(
        atendimentoId,
        atendimentoAtualizado,
      );
    });

    it('altera para paciente TEA quando o novo paciente é informado', async () => {
      const updateDto: UpdateAtendimentoDto = {
        pacienteId: pacienteTeaId,
        isTea: true,
      };
      const atendimentoAtualizado: CreateAtendimentoDto = {
        ...createDto,
        pacienteId: pacienteTeaId,
        isTea: true,
      };
      const registroAtualizado: AtendimentoRecord = {
        ...atendimento,
        ...atendimentoAtualizado,
      };
      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockResolvedValue(registroAtualizado);

      await expect(service.update(atendimentoId, updateDto)).resolves.toBe(
        registroAtualizado,
      );

      expect(repository.update).toHaveBeenCalledWith(
        atendimentoId,
        atendimentoAtualizado,
        client,
      );
      expect(listaEsperaService.retirarPorAgendamento).toHaveBeenCalledWith(
        { tipo: TipoPaciente.TEA, id: pacienteTeaId },
        client,
      );
      expect(repository.isPacienteAtivo).toHaveBeenCalledWith(
        pacienteTeaId,
        true,
      );
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        2,
        pacienteTeaId,
        dataInicio,
        'paciente_tea',
        atendimentoId,
      );
    });

    it('altera para paciente comum quando o novo paciente é informado', async () => {
      const atendimentoTea: AtendimentoRecord = {
        ...atendimento,
        pacienteId: pacienteTeaId,
        isTea: true,
      };
      repository.findOne.mockResolvedValue(atendimentoTea);
      repository.update.mockResolvedValue(atendimento);

      await expect(
        service.update(atendimentoId, { pacienteId, isTea: false }),
      ).resolves.toBe(atendimento);

      expect(repository.update).toHaveBeenCalledWith(
        atendimentoId,
        createDto,
        client,
      );
      expect(listaEsperaService.retirarPorAgendamento).toHaveBeenCalledWith(
        { tipo: TipoPaciente.BENEFICIARIO, id: pacienteId },
        client,
      );
    });

    it('não mexe na lista de espera quando o atendimento com novo paciente não é encontrado na gravação', async () => {
      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockResolvedValue(null);

      await expect(
        service.update(atendimentoId, { pacienteId: '99', isTea: false }),
      ).resolves.toBeNull();

      expect(repository.emTransacao).toHaveBeenCalledTimes(1);
      expect(listaEsperaService.retirarPorAgendamento).not.toHaveBeenCalled();
    });

    it('exige o novo paciente ao alterar o tipo do paciente', async () => {
      repository.findOne.mockResolvedValue(atendimento);

      await expect(
        service.update(atendimentoId, { isTea: true }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('exige o novo paciente ao alterar de paciente TEA para comum', async () => {
      repository.findOne.mockResolvedValue({
        ...atendimento,
        pacienteId: pacienteTeaId,
        isTea: true,
      });

      await expect(
        service.update(atendimentoId, { isTea: false }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('revalida quando apenas o profissional é alterado', async () => {
      const outroProfissionalId = 'c1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b';
      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockResolvedValue(atendimento);

      await service.update(atendimentoId, {
        profissionalId: outroProfissionalId,
      });

      expect(profissionaisService.findOne).toHaveBeenCalledWith(
        outroProfissionalId,
      );
      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        1,
        outroProfissionalId,
        dataInicio,
        'profissional',
        atendimentoId,
      );
    });

    it('rejeita trocar para um profissional inativo', async () => {
      repository.findOne.mockResolvedValue(atendimento);
      profissionaisService.findOne.mockResolvedValue({
        horario_inicio: '08:00',
        horario_fim: '17:00',
        ativo: false,
      });

      await expect(
        service.update(atendimentoId, {
          profissionalId: 'c1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('ignora o próprio atendimento ao verificar conflitos', async () => {
      const novaDataInicio = new Date('2030-10-29T13:10:00.000Z');
      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockResolvedValue(atendimento);

      await service.update(atendimentoId, { dataInicio: novaDataInicio });

      for (const chamada of repository.hasTimeConflict.mock.calls) {
        expect(chamada[3]).toBe(atendimentoId);
      }
      expect(repository.update).toHaveBeenCalled();
    });

    it('rejeita uma atualização vazia', async () => {
      await expect(service.update(atendimentoId, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o atendimento a atualizar não existe', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update(atendimentoId, { tipo: TipoAtendimento.PEDAGOGIA }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejeita uma nova data fora da disponibilidade do profissional', async () => {
      const novaDataInicio = new Date('2030-10-29T14:00:00.000Z');
      repository.findOne.mockResolvedValue(atendimento);
      profissionaisService.findOne.mockResolvedValue({
        horario_inicio: '10:00',
        horario_fim: '10:10',
      });

      await expect(
        service.update(atendimentoId, { dataInicio: novaDataInicio }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repository.update).not.toHaveBeenCalled();
      expect(repository.hasTimeConflict).toHaveBeenCalledTimes(2);
    });

    it('rejeita nova data conflitante com outro atendimento do profissional', async () => {
      const novaDataInicio = new Date('2030-10-29T14:00:00.000Z');
      repository.findOne.mockResolvedValue(atendimento);
      repository.hasTimeConflict.mockResolvedValueOnce(true);

      await expect(
        service.update(atendimentoId, { dataInicio: novaDataInicio }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repository.hasTimeConflict).toHaveBeenCalledTimes(1);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejeita nova data conflitante com outro atendimento do paciente', async () => {
      const novaDataInicio = new Date('2030-10-29T14:00:00.000Z');
      repository.findOne.mockResolvedValue(atendimento);
      repository.hasTimeConflict
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        service.update(atendimentoId, { dataInicio: novaDataInicio }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repository.hasTimeConflict).toHaveBeenCalledTimes(2);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejeita uma nova data conflitante para paciente TEA', async () => {
      const novaDataInicio = new Date('2030-10-29T14:00:00.000Z');
      const atendimentoTea: AtendimentoRecord = {
        ...atendimento,
        pacienteId: pacienteTeaId,
        isTea: true,
      };
      repository.findOne.mockResolvedValue(atendimentoTea);
      repository.hasTimeConflict
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await expect(
        service.update(atendimentoId, { dataInicio: novaDataInicio }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(repository.hasTimeConflict).toHaveBeenNthCalledWith(
        2,
        pacienteTeaId,
        novaDataInicio,
        'paciente_tea',
        atendimentoId,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('retorna null quando o repositório não retorna o atendimento atualizado', async () => {
      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockResolvedValue(null);

      await expect(
        service.update(atendimentoId, { tipo: TipoAtendimento.PEDAGOGIA }),
      ).resolves.toBeNull();
    });

    it('propaga falhas ao atualizar o atendimento no repositório', async () => {
      const error = new Error('falha de persistência');
      repository.findOne.mockResolvedValue(atendimento);
      repository.update.mockRejectedValue(error);

      await expect(
        service.update(atendimentoId, { tipo: TipoAtendimento.PEDAGOGIA }),
      ).rejects.toBe(error);
    });
  });

  describe('cancel', () => {
    const atendimentoCancelado: AtendimentoRecord = {
      ...atendimento,
      status: StatusAtendimento.CANCELADO,
      canceladoEm: new Date('2030-10-28T12:00:00.000Z'),
      motivoCancelamento: 'Paciente viajou',
    };

    it('cancela o atendimento mantendo o histórico, com o motivo', async () => {
      repository.findOne.mockResolvedValue(atendimento);
      repository.cancel.mockResolvedValue(atendimentoCancelado);

      await expect(
        service.cancel(atendimentoId, '  Paciente viajou  '),
      ).resolves.toBe(atendimentoCancelado);
      expect(repository.cancel).toHaveBeenCalledWith(
        atendimentoId,
        'Paciente viajou',
      );
    });

    it('cancela sem motivo quando ele não é informado ou está vazio', async () => {
      repository.findOne.mockResolvedValue(atendimento);
      repository.cancel.mockResolvedValue(atendimentoCancelado);

      await service.cancel(atendimentoId, '   ');

      expect(repository.cancel).toHaveBeenCalledWith(atendimentoId, undefined);
    });

    it('lança NotFoundException quando o atendimento não existe', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.cancel(atendimentoId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.cancel).not.toHaveBeenCalled();
    });

    it('rejeita cancelar um atendimento já cancelado', async () => {
      repository.findOne.mockResolvedValue(atendimentoCancelado);

      await expect(service.cancel(atendimentoId)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.cancel).not.toHaveBeenCalled();
    });

    it('rejeita quando outra requisição cancelou o atendimento antes', async () => {
      repository.findOne.mockResolvedValue(atendimento);
      repository.cancel.mockResolvedValue(null);

      await expect(service.cancel(atendimentoId)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it('não permite alterar um atendimento cancelado', async () => {
    repository.findOne.mockResolvedValue({
      ...atendimento,
      status: StatusAtendimento.CANCELADO,
      canceladoEm: new Date('2030-10-28T12:00:00.000Z'),
    });

    await expect(
      service.update(atendimentoId, { tipo: TipoAtendimento.PEDAGOGIA }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('repassa o filtro de status na listagem', async () => {
    repository.findAll.mockResolvedValue([atendimento]);

    await service.findAll(StatusAtendimento.AGENDADO);

    expect(repository.findAll).toHaveBeenCalledWith(StatusAtendimento.AGENDADO);
  });
});

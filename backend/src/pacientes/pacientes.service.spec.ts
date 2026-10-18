import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateBeneficiarioDto } from './dto/create-paciente.dto';
import { PacienteRecord, PacientesRepository } from './pacientes.repository';
import { PacientesService } from './pacientes.service';

describe('PacientesService', () => {
  let service: PacientesService;

  const repository = {
    create:
      jest.fn<
        (
          paciente: CreateBeneficiarioDto & { dataCadastro: string },
        ) => Promise<PacienteRecord>
      >(),
    findAll: jest.fn<() => Promise<PacienteRecord[]>>(),
    findOne: jest.fn<(id: number) => Promise<PacienteRecord | null>>(),
    update:
      jest.fn<
        (
          id: number,
          paciente: Partial<CreateBeneficiarioDto>,
        ) => Promise<PacienteRecord | null>
      >(),
    remove: jest.fn<(id: number) => Promise<boolean>>(),
  };

  const createDto: CreateBeneficiarioDto = {
    numeroCadastro: '12345',
    nomeBeneficiario: 'João',
    dataNascimento: '2010-01-01',
    rg: '1234567',
    cpf: '123.456.789-00',
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
    possuiDefice: false,
    fazAcompanhamento: false,
    fazUsoMedicacao: false,
  };

  beforeEach(() => {
    service = new PacientesService(
      repository as unknown as PacientesRepository,
    );
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('adds the system registration date before creating a patient', async () => {
      const now = new Date('2026-10-18T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);
      repository.create.mockResolvedValue({
        id: 1,
        ...createDto,
        dataCadastro: now.toISOString(),
      });

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        dataCadastro: now.toISOString(),
      });
      expect(result).toEqual({
        id: 1,
        ...createDto,
        dataCadastro: now.toISOString(),
      });
    });

    it('propagates persistence failures', async () => {
      const error = new Error('database unavailable');
      repository.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toBe(error);
    });

    it('rejects missing answers for enabled conditional questions', async () => {
      await expect(
        service.create({ ...createDto, fazUsoMedicacao: true }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  it('lists patients', async () => {
    const patients = [
      {
        id: 1,
        ...createDto,
        dataCadastro: '2026-10-18T12:00:00.000Z',
      },
    ];
    repository.findAll.mockResolvedValue(patients);

    await expect(service.findAll()).resolves.toBe(patients);
    expect(repository.findAll).toHaveBeenCalledTimes(1);
  });

  describe('findOne', () => {
    it('returns a patient by id', async () => {
      const patient = {
        id: 1,
        ...createDto,
        dataCadastro: '2026-10-18T12:00:00.000Z',
      };
      repository.findOne.mockResolvedValue(patient);

      await expect(service.findOne(1)).resolves.toBe(patient);
      expect(repository.findOne).toHaveBeenCalledWith(1);
    });

    it('throws when the patient does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects invalid ids before accessing the repository', async () => {
      await expect(service.findOne(0)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates and returns the patient', async () => {
      const update = { nomeBeneficiario: 'João Silva' };
      const patient = {
        id: 1,
        ...createDto,
        dataCadastro: '2026-10-18T12:00:00.000Z',
        ...update,
      };
      repository.findOne.mockResolvedValue({
        id: 1,
        ...createDto,
        dataCadastro: '2026-10-18T12:00:00.000Z',
      });
      repository.update.mockResolvedValue(patient);

      await expect(service.update(1, update)).resolves.toBe(patient);
      expect(repository.update).toHaveBeenCalledWith(1, update);
    });

    it('rejects an update that enables a dependent question without its answers', async () => {
      repository.findOne.mockResolvedValue({
        id: 1,
        ...createDto,
        dataCadastro: '2026-10-18T12:00:00.000Z',
      });

      await expect(
        service.update(1, { possuiIrmaos: true }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects an empty update', async () => {
      await expect(service.update(1, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('throws when the patient does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update(1, { nomeBeneficiario: 'João Silva' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes an existing patient', async () => {
      repository.remove.mockResolvedValue(true);

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(repository.remove).toHaveBeenCalledWith(1);
    });

    it('throws when the patient does not exist', async () => {
      repository.remove.mockResolvedValue(false);

      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

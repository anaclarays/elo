import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PacientesTeaController } from '../controller/pacientes-tea.controller';
import { PacientesTeaService } from '../service/pacientes-tea.service';
import { CategoriaEtaria } from '../enum/pacientes-tea.enum';

describe('PacientesTeaController', () => {
  let controller: PacientesTeaController;
  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PacientesTeaController],
      providers: [{ provide: PacientesTeaService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard) // nos testes, o login é ignorado
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PacientesTeaController>(PacientesTeaController);
  });

  it('delega a criação para o service', async () => {
    const dto = { nomeCompleto: 'Teste' } as any;
    mockService.create.mockResolvedValueOnce({ id: '1' });

    const resultado = await controller.create(dto);

    expect(mockService.create).toHaveBeenCalledWith(dto);
    expect(resultado).toEqual({ id: '1' });
  });

  it('delega a listagem para o service, repassando os filtros', async () => {
    mockService.findAll.mockResolvedValueOnce([]);

    await controller.findAll('11144477735', 'ana', 5, CategoriaEtaria.CRIANCA);

    expect(mockService.findAll).toHaveBeenCalledWith({
      cpf: '11144477735',
      nome: 'ana',
      numeroCadastro: 5,
      categoria: CategoriaEtaria.CRIANCA,
    });
  });

  it('delega a busca por id para o service', async () => {
    mockService.findOne.mockResolvedValueOnce({ id: '1' });

    await controller.findOne('1');

    expect(mockService.findOne).toHaveBeenCalledWith('1');
  });

  it('delega a atualização para o service', async () => {
    const dto = { nivelSuporte: 3 } as any;
    mockService.update.mockResolvedValueOnce({ id: '1' });

    await controller.update('1', dto);

    expect(mockService.update).toHaveBeenCalledWith('1', dto);
  });

  it('delega a remoção para o service', async () => {
    mockService.remove.mockResolvedValueOnce({ message: 'ok' });

    await controller.remove('1');

    expect(mockService.remove).toHaveBeenCalledWith('1');
  });
});
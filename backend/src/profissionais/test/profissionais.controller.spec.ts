import { Test, TestingModule } from '@nestjs/testing';
import { ProfissionaisController } from '../controller/profissionais.controller';
import { ProfissionaisService } from '../service/profissionais.service';

describe('ProfissionaisController', () => {
  let controller: ProfissionaisController;
  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfissionaisController],
      providers: [{ provide: ProfissionaisService, useValue: mockService }],
    }).compile();

    controller = module.get<ProfissionaisController>(ProfissionaisController);
  });

  it('deve delegar a criação para o service', async () => {
    const dto = { nomeCompleto: 'Teste' } as any;
    mockService.create.mockResolvedValueOnce({ id: '1' });

    const resultado = await controller.create(dto);

    expect(mockService.create).toHaveBeenCalledWith(dto);
    expect(resultado).toEqual({ id: '1' });
  });

    it('deve delegar a listagem para o service, repassando os filtros', async () => {
    mockService.findAll.mockResolvedValueOnce([]);

    await controller.findAll('11144477735', 'layse');

    expect(mockService.findAll).toHaveBeenCalledWith({
      cpf: '11144477735',
      nome: 'layse',
    });
  });

  it('deve delegar a busca por id para o service', async () => {
    mockService.findOne.mockResolvedValueOnce({ id: '1' });

    await controller.findOne('1');

    expect(mockService.findOne).toHaveBeenCalledWith('1');
  });

  it('deve delegar a atualização para o service', async () => {
    const dto = { cargo: 'Novo' } as any;
    mockService.update.mockResolvedValueOnce({ id: '1', ...dto });

    await controller.update('1', dto);

    expect(mockService.update).toHaveBeenCalledWith('1', dto);
  });

  it('deve delegar a remoção para o service', async () => {
    mockService.remove.mockResolvedValueOnce({ message: 'ok' });

    await controller.remove('1');

    expect(mockService.remove).toHaveBeenCalledWith('1');
  });
});
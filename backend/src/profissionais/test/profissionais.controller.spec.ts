import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ProfissionaisController } from '../controller/profissionais.controller';
import { ProfissionaisService } from '../service/profissionais.service';

describe('ProfissionaisController', () => {
  let controller: ProfissionaisController;
  const mockService: any = {
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
    (mockService.create as any).mockResolvedValueOnce({ id: '1' });

    const resultado = await controller.create(dto);

    expect(mockService.create).toHaveBeenCalledWith(dto);
    expect(resultado).toEqual({ id: '1' });
  });

    it('deve delegar a listagem para o service, repassando os filtros', async () => {
    (mockService.findAll as any).mockResolvedValueOnce([]);

    await controller.findAll('11144477735', 'layse');

    expect(mockService.findAll).toHaveBeenCalledWith({
      cpf: '11144477735',
      nome: 'layse',
    });
  });

  it('deve delegar a busca por id para o service', async () => {
    (mockService.findOne as any).mockResolvedValueOnce({ id: '1' });

    await controller.findOne('1');

    expect(mockService.findOne).toHaveBeenCalledWith('1');
  });

  it('deve delegar a atualização para o service', async () => {
    const dto = { cargo: 'Novo' } as any;
    (mockService.update as any).mockResolvedValueOnce({ id: '1', ...dto });

    await controller.update('1', dto);

    expect(mockService.update).toHaveBeenCalledWith('1', dto);
  });

  it('deve aceitar atualização parcial via patch', async () => {
    const dto = { cargo: 'Novo Cargo' } as any;
    (mockService.update as any).mockResolvedValueOnce({ id: '1', ...dto });

    await controller.update('1', dto);

    expect(mockService.update).toHaveBeenCalledWith('1', dto);
  });

  it('deve delegar a remoção para o service', async () => {
    (mockService.remove as any).mockResolvedValueOnce({ message: 'ok' });

    await controller.remove('1');

    expect(mockService.remove).toHaveBeenCalledWith('1');
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RelatoriosController } from '../controller/relatorios.controller';
import { CoordenacaoGuard } from '../guards/coordenacao.guard';
import { RelatoriosService } from '../service/relatorios.service';

describe('RelatoriosController', () => {
  let controller: RelatoriosController;
  const mockService = {
    geral: jest.fn(),
    pacientes: jest.fn(),
    listaEspera: jest.fn(),
    atendimentos: jest.fn(),
    profissionais: jest.fn(),
  };
  const novembro = { dataInicio: '2026-11-01', dataFim: '2026-11-30' };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RelatoriosController],
      providers: [{ provide: RelatoriosService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(CoordenacaoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RelatoriosController>(RelatoriosController);
  });

  it('exige login e perfil da coordenação em todas as rotas', () => {
    const guards = Reflect.getMetadata('__guards__', RelatoriosController);

    expect(guards).toEqual([JwtAuthGuard, CoordenacaoGuard]);
  });

  it.each([
    ['geral', 'geral'],
    ['pacientes', 'pacientes'],
    ['listaEspera', 'listaEspera'],
    ['atendimentos', 'atendimentos'],
    ['profissionais', 'profissionais'],
  ] as const)('%s repassa o período para o service', async (rota, metodo) => {
    mockService[metodo].mockResolvedValueOnce({ periodo: novembro });

    await expect(controller[rota](novembro)).resolves.toEqual({
      periodo: novembro,
    });
    expect(mockService[metodo]).toHaveBeenCalledWith(novembro);
  });
});

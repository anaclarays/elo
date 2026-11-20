import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ListaEsperaController } from '../controller/lista-espera.controller';
import { TipoPaciente } from '../enum/lista-espera.enum';
import { ListaEsperaService } from '../service/lista-espera.service';

describe('ListaEsperaController', () => {
  let controller: ListaEsperaController;
  const mockService = {
    consultar: jest.fn(),
    adicionarManualmente: jest.fn(),
    retirarManualmente: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListaEsperaController],
      providers: [{ provide: ListaEsperaService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard) // nos testes, o login é ignorado
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ListaEsperaController>(ListaEsperaController);
  });

  it('delega a consulta para o service, repassando os filtros', async () => {
    mockService.consultar.mockResolvedValueOnce([{ id: '1', posicao: 1 }]);

    const resultado = await controller.consultar(TipoPaciente.TEA, 'ana');

    expect(mockService.consultar).toHaveBeenCalledWith({
      tipo: TipoPaciente.TEA,
      nome: 'ana',
    });
    expect(resultado).toEqual([{ id: '1', posicao: 1 }]);
  });

  it('consulta sem filtros', async () => {
    await controller.consultar();

    expect(mockService.consultar).toHaveBeenCalledWith({
      tipo: undefined,
      nome: undefined,
    });
  });

  it('delega a inclusão manual para o service', async () => {
    const dto = { tipoPaciente: TipoPaciente.BENEFICIARIO, pacienteId: 7 };
    mockService.adicionarManualmente.mockResolvedValueOnce({ id: 'r1' });

    const resultado = await controller.adicionar(dto);

    expect(mockService.adicionarManualmente).toHaveBeenCalledWith(dto);
    expect(resultado).toEqual({ id: 'r1' });
  });

  it('repassa a justificativa e o profissional logado na retirada manual', async () => {
    mockService.retirarManualmente.mockResolvedValueOnce({ id: 'r1' });
    const request = { user: { sub: 'prof-1' } } as any;

    await controller.retirar(
      'r1',
      { justificativa: 'Mudou de cidade' },
      request,
    );

    expect(mockService.retirarManualmente).toHaveBeenCalledWith(
      'r1',
      'Mudou de cidade',
      'prof-1',
    );
  });
});

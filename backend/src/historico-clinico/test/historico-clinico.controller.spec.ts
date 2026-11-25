import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HistoricoClinicoController } from '../controller/historico-clinico.controller';
import { TipoRegistroClinico } from '../enum/historico-clinico.enum';
import { HistoricoClinicoService } from '../service/historico-clinico.service';

describe('HistoricoClinicoController', () => {
  let controller: HistoricoClinicoController;
  const mockService = {
    listarPorPaciente: jest.fn(),
    listarPorPacienteTea: jest.fn(),
    buscarRegistro: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HistoricoClinicoController],
      providers: [{ provide: HistoricoClinicoService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard) // nos testes, o login é ignorado
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<HistoricoClinicoController>(
      HistoricoClinicoController,
    );
  });

  it('delega ao service a consulta do histórico de um paciente, repassando os filtros', async () => {
    const filtros = {
      dataInicio: '2026-09-01',
      tipo: TipoRegistroClinico.ATENDIMENTO,
    };
    mockService.listarPorPaciente.mockResolvedValueOnce({ total: 0 });

    await controller.listarPorPaciente(3, filtros);

    expect(mockService.listarPorPaciente).toHaveBeenCalledWith(3, filtros);
  });

  it('delega ao service a consulta do histórico de um paciente de TEA', async () => {
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    mockService.listarPorPacienteTea.mockResolvedValueOnce({ total: 0 });

    await controller.listarPorPacienteTea(id, {});

    expect(mockService.listarPorPacienteTea).toHaveBeenCalledWith(id, {});
  });

  it('delega ao service a busca de um registro', async () => {
    mockService.buscarRegistro.mockResolvedValueOnce({ id: 'r1' });

    const resultado = await controller.buscarRegistro('r1');

    expect(mockService.buscarRegistro).toHaveBeenCalledWith('r1');
    expect(resultado).toEqual({ id: 'r1' });
  });
});

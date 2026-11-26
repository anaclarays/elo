import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { CoordenacaoGuard } from '../../auth/guards/coordenacao.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  IdSugestaoPipe,
  SugestoesController,
} from '../controller/sugestoes.controller';
import { SugestoesService } from '../service/sugestoes.service';

describe('SugestoesController', () => {
  let controller: SugestoesController;
  const mockService = {
    listar: jest.fn(),
    historico: jest.fn(),
    aprovar: jest.fn(),
    descartar: jest.fn(),
  };
  const id = 'a'.repeat(24);
  const request = { user: { sub: 'usuario-1' } } as never;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SugestoesController],
      providers: [{ provide: SugestoesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard) // nos testes, o login é ignorado
      .useValue({ canActivate: () => true })
      .overrideGuard(CoordenacaoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SugestoesController>(SugestoesController);
  });

  it('exige login e perfil de coordenação em todas as rotas', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SugestoesController)).toEqual([
      JwtAuthGuard,
      CoordenacaoGuard,
    ]);
  });

  it('lista as sugestões', async () => {
    mockService.listar.mockResolvedValueOnce({ sugestoes: [] });
    await expect(controller.listar()).resolves.toEqual({ sugestoes: [] });
  });

  it('lista o histórico de decisões', async () => {
    mockService.historico.mockResolvedValueOnce([]);
    await expect(controller.historico()).resolves.toEqual([]);
  });

  it('aprova em nome de quem está logado', async () => {
    await controller.aprovar(id, request);
    expect(mockService.aprovar).toHaveBeenCalledWith(id, 'usuario-1');
  });

  it('descarta com o motivo informado', async () => {
    await controller.descartar(id, { motivo: 'Sem disponibilidade' }, request);
    expect(mockService.descartar).toHaveBeenCalledWith(
      id,
      'Sem disponibilidade',
      'usuario-1',
    );
  });
});

describe('IdSugestaoPipe', () => {
  const pipe = new IdSugestaoPipe();

  it('aceita um id de 24 caracteres hexadecimais', () => {
    expect(pipe.transform('0123456789abcdef01234567')).toBe(
      '0123456789abcdef01234567',
    );
  });

  it.each(['curto', 'g'.repeat(24), 'A'.repeat(24), '1'.repeat(25)])(
    'recusa %s',
    (valor) => {
      expect(() => pipe.transform(valor)).toThrow(BadRequestException);
    },
  );
});

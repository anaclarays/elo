import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Pool } from 'pg';
import { CoordenacaoGuard } from '../guards/coordenacao.guard';

describe('CoordenacaoGuard', () => {
  let guard: CoordenacaoGuard;
  const pool = { query: jest.fn() };

  const contexto = (user?: { sub?: string }) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  const acessoNegado = new ForbiddenException(
    'Acesso permitido apenas à coordenação administrativa',
  );

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new CoordenacaoGuard(pool as unknown as Pool);
  });

  it('libera profissional ativo da coordenação administrativa', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    await expect(guard.canActivate(contexto({ sub: 'prof-1' }))).resolves.toBe(
      true,
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ativo = true AND area_atuacao = $2'),
      ['prof-1', 'coordenacao_administrativa'],
    );
  });

  it('bloqueia profissional de outra área ou inativo', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      guard.canActivate(contexto({ sub: 'prof-2' })),
    ).rejects.toThrow(acessoNegado);
  });

  it.each([[undefined], [{}]])(
    'bloqueia requisição sem profissional identificado (%j), sem consultar o banco',
    async (user) => {
      await expect(guard.canActivate(contexto(user))).rejects.toThrow(
        acessoNegado,
      );
      expect(pool.query).not.toHaveBeenCalled();
    },
  );

  it('propaga falhas do banco', async () => {
    const erro = new Error('falha no banco');
    pool.query.mockRejectedValueOnce(erro);

    await expect(guard.canActivate(contexto({ sub: 'prof-1' }))).rejects.toBe(
      erro,
    );
  });
});

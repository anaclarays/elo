import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
  const guard = new JwtAuthGuard(jwt);
  const request: any = { headers: { authorization: 'Bearer signed-token' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    request.headers.authorization = 'Bearer signed-token';
  });

  it('aceita JWT válido e associa payload à requisição', async () => {
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'profissional-id',
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: 'profissional-id' });
  });

  it('recusa requisição sem bearer token', async () => {
    request.headers.authorization = undefined;
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('recusa JWT inválido', async () => {
    (jwt.verifyAsync as jest.Mock).mockRejectedValue(new Error('invalid'));
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

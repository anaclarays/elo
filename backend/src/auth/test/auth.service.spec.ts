import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService, MAIL_TRANSPORT } from '../service/auth.service';
import { PG_POOL } from '../../database/database.constants';
import * as bcrypt from 'bcrypt';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  const mockPool: any = { query: jest.fn(), connect: jest.fn() };
  const config = { get: jest.fn() };
  const jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') };
  const mailTransport = { sendMail: jest.fn() };
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mailTransport.sendMail.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PG_POOL, useValue: mockPool },
        { provide: ConfigService, useValue: config },
        { provide: JwtService, useValue: jwt },
        { provide: MAIL_TRANSPORT, useValue: mailTransport },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('autentica credenciais válidas e não retorna o hash', async () => {
    const hash = await bcrypt.hash('Senha@123', 4);
    mockPool.query.mockResolvedValueOnce({
      rows: [
        {
          id: '1',
          email: 'a@b.com',
          nome_completo: 'A',
          cargo: 'B',
          senha_hash: hash,
        },
      ],
    });
    const result = await service.login({
      email: 'a@b.com',
      senha: 'Senha@123',
    });
    expect(result.profissional).toEqual({
      id: '1',
      nomeCompleto: 'A',
      email: 'a@b.com',
      cargo: 'B',
    });
    expect(result.accessToken).toBe('jwt-token');
  });

  it('recusa credenciais inválidas', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      service.login({ email: 'a@b.com', senha: 'errada' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('retorna resposta neutra para e-mail não cadastrado', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [] });
    expect(
      await service.solicitarRecuperacao({ email: 'a@b.com' }),
    ).toHaveProperty('message');
  });

  it('retorna resposta neutra quando o envio falha para e-mail existente', async () => {
    config.get.mockImplementation(
      (key: string) =>
        ({
          PASSWORD_RESET_URL: 'https://app.teste/redefinir-senha',
          SMTP_HOST: 'smtp.teste',
          SMTP_USER: 'u',
          SMTP_PASS: 'p',
          SMTP_FROM: 'from@teste.com',
        })[key],
    );
    mailTransport.sendMail.mockRejectedValue(new Error('smtp down'));
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{ id: '1', email: 'a@b.com', nome_completo: '<b>A</b>' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const result = await service.solicitarRecuperacao({ email: 'a@b.com' });
    expect(result).toHaveProperty('message');
    expect(mockPool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('usado_em = NOW()'),
      expect.any(Array),
    );
  });

  it('rejeita token de redefinição malformado no body', async () => {
    await expect(
      service.redefinirSenha({ token: 'ruim', senha: 'Senha@123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('consome o token e atualiza senha dentro de transação', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'token', profissional_id: '1' }] })
      .mockResolvedValue({});
    mockPool.connect.mockResolvedValueOnce(client);
    await service.redefinirSenha({ token: 'a'.repeat(64), senha: 'Senha@123' });
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('faz rollback quando a redefinição não encontra token válido', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({});
    mockPool.connect.mockResolvedValueOnce(client);
    await expect(
      service.redefinirSenha({ token: 'b'.repeat(64), senha: 'Senha@123' }),
    ).rejects.toThrow(BadRequestException);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

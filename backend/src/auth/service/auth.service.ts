import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import * as nodemailer from 'nodemailer';
import { StringValue } from 'ms';
import { PG_POOL } from '../../database/database.constants';
import { LoginDto } from '../dto/login.dto';
import { RedefinirSenhaDto } from '../dto/redefinir-senha.dto';
import { SolicitarRecuperacaoDto } from '../dto/solicitar-recuperacao.dto';

const RESPOSTA_RECUPERACAO = {
  message: 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.',
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const result = await this.pool.query(
      `SELECT id, nome_completo, email, cargo, senha_hash
       FROM profissionais WHERE LOWER(email) = LOWER($1) AND ativo = true LIMIT 1`,
      [dto.email.trim()],
    );
    const profissional = result.rows[0];
    const hashComparacao = profissional?.senha_hash ?? '$2b$10$C6UzMDM.H6dfI/f/IKcEe.0u7Rj7J5J5j0d0qZ6JQz7xXQw0v7y6W';
    const senhaValida = await bcrypt.compare(dto.senha, hashComparacao).catch(() => false);
    if (!profissional || !senhaValida) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    const accessToken = await this.jwt.signAsync(
      { sub: profissional.id, email: profissional.email, cargo: profissional.cargo },
      { expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ?? '15m') as StringValue },
    );
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
      profissional: {
        id: profissional.id,
        nomeCompleto: profissional.nome_completo,
        email: profissional.email,
        cargo: profissional.cargo,
      },
    };
  }

  async solicitarRecuperacao(dto: SolicitarRecuperacaoDto) {
    const result = await this.pool.query(
      `SELECT id, email, nome_completo FROM profissionais
       WHERE LOWER(email) = LOWER($1) AND ativo = true LIMIT 1`,
      [dto.email.trim()],
    );
    const profissional = result.rows[0];
    if (!profissional) return RESPOSTA_RECUPERACAO;

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiraEm = new Date(Date.now() + 30 * 60 * 1000);
    await this.pool.query(
      `UPDATE recuperacao_senha_tokens SET usado_em = NOW()
       WHERE profissional_id = $1 AND usado_em IS NULL`,
      [profissional.id],
    );
    await this.pool.query(
      `INSERT INTO recuperacao_senha_tokens (profissional_id, token_hash, expira_em)
       VALUES ($1, $2, $3)`,
      [profissional.id, tokenHash, expiraEm],
    );

    if (this.config.get<string>('NODE_ENV') !== 'production') {
      const urlBaseDev = this.config.get<string>('PASSWORD_RESET_URL') ?? 'http://localhost:3000/recuperar-senha';
      this.logger.debug(`[DEV] Token de recuperação para ${profissional.email}: ${token}`);
      this.logger.debug(`[DEV] Link: ${urlBaseDev}?token=${token}`);
    }

    const urlBase = this.config.get<string>('PASSWORD_RESET_URL');
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM');
    if (!urlBase || !host || !user || !pass || !from) {
      this.logger.error('Configuração de recuperação de senha incompleta; e-mail não enviado.');
    } else {
      let url: URL;
      try {
        url = new URL(urlBase);
      } catch {
        throw new BadRequestException('URL de redefinição de senha inválida');
      }
      if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
        throw new BadRequestException('URL de redefinição deve usar HTTPS');
      }
      url.searchParams.set('token', token);
      const link = url.toString();
      const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
      const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
      try {
        await transport.sendMail({
          from,
          to: profissional.email,
          subject: 'Redefinição de senha - ELO',
          text: `Olá, ${profissional.nome_completo}. Use este link para redefinir sua senha em até 30 minutos: ${link}`,
          html: `<p>Olá, ${profissional.nome_completo}.</p><p><a href="${link}">Redefinir senha</a></p><p>O link expira em 30 minutos. Se você não solicitou a alteração, ignore esta mensagem.</p>`,
        });
      } catch {
        await this.pool.query(
          `UPDATE recuperacao_senha_tokens SET usado_em = NOW() WHERE token_hash = $1 AND usado_em IS NULL`,
          [tokenHash],
        );
        this.logger.error('Falha ao enviar e-mail de recuperação.');
        throw new BadRequestException('Não foi possível enviar o e-mail de recuperação');
      }
    }
    return RESPOSTA_RECUPERACAO;
  }

  async redefinirSenha(token: string, dto: RedefinirSenhaDto) {
    if (!token || token.length !== 64 || !/^[a-f0-9]+$/i.test(token)) {
      throw new BadRequestException('Token inválido ou expirado');
    }
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const senhaHash = await bcrypt.hash(dto.senha, 12);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resultado = await client.query(
        `SELECT id, profissional_id FROM recuperacao_senha_tokens
         WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > NOW()
         FOR UPDATE`,
        [tokenHash],
      );
      const registro = resultado.rows[0];
      if (!registro) throw new BadRequestException('Token inválido ou expirado');
      await client.query(
        `UPDATE profissionais SET senha_hash = $1, updated_at = NOW() WHERE id = $2 AND ativo = true`,
        [senhaHash, registro.profissional_id],
      );
      await client.query(
        `UPDATE recuperacao_senha_tokens SET usado_em = NOW()
         WHERE profissional_id = $1 AND usado_em IS NULL`,
        [registro.profissional_id],
      );
      await client.query('COMMIT');
      return { message: 'Senha redefinida com sucesso' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

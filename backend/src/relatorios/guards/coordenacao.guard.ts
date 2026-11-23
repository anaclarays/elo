import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.constants';
import { AreaAtuacao } from '../../profissionais/dto/create-profissional.dto';

const MENSAGEM = 'Acesso permitido apenas à coordenação administrativa';

// Deve vir depois do JwtAuthGuard, que coloca o token em request.user.
// A área é lida do banco a cada acesso, então a permissão muda assim que o
// cadastro do profissional muda.
@Injectable()
export class CoordenacaoGuard implements CanActivate {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { sub?: string } }>();
    const profissionalId = request.user?.sub;
    if (!profissionalId) {
      throw new ForbiddenException(MENSAGEM);
    }

    const resultado = await this.pool.query(
      `SELECT 1 FROM profissionais
       WHERE id = $1 AND ativo = true AND area_atuacao = $2`,
      [profissionalId, AreaAtuacao.COORDENACAO_ADMINISTRATIVA],
    );
    if (resultado.rows.length === 0) {
      throw new ForbiddenException(MENSAGEM);
    }
    return true;
  }
}

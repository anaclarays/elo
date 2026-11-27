import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { AreaAtuacao } from '../profissionais/dto/create-profissional.dto';
import {
  AtendimentoAgenda,
  ProfissionalAgenda,
  TipoSugestao,
} from './sugestoes.regras';

export enum Decisao {
  APROVADA = 'aprovada',
  DESCARTADA = 'descartada',
  MODIFICADA = 'modificada',
}

export interface NovaDecisao {
  sugestaoId: string;
  tipo: TipoSugestao;
  titulo: string;
  decisao: Decisao;
  motivo: string | null;
  // O que foi alterado antes de aprovar (só nas decisões "modificada")
  ajuste?: string | null;
  profissionais: string[];
  // Atendimentos que a coordenação decidiu manter numa redução de frequência
  atendimentosMantidos?: string[];
  decididoPor: string;
}

export interface DecisaoRegistrada extends NovaDecisao {
  id: string;
  decididoEm: Date;
}

export interface DecisaoHistorico extends DecisaoRegistrada {
  decididoPorNome: string;
}

const PROJECAO_DECISAO = `id, sugestao_id AS "sugestaoId", tipo, titulo, decisao, motivo,
  ajuste, profissionais, decidido_por AS "decididoPor", decidido_em AS "decididoEm"`;

@Injectable()
export class SugestoesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // Profissionais que atendem: ativos, fora da coordenação e sem status "Inativo"
  async listarProfissionais(): Promise<ProfissionalAgenda[]> {
    const { rows } = await this.pool.query(
      `SELECT id,
              nome_completo AS nome,
              area_atuacao AS area,
              capacidade_semanal AS "capacidadeSemanal",
              to_char(horario_inicio, 'HH24:MI') AS "horarioInicio",
              to_char(horario_fim, 'HH24:MI') AS "horarioFim"
         FROM profissionais
        WHERE ativo = true
          AND area_atuacao <> $1
          AND lower(btrim(coalesce(status, ''))) <> 'inativo'
        ORDER BY nome_completo`,
      [AreaAtuacao.COORDENACAO_ADMINISTRATIVA],
    );
    return rows;
  }

  async listarAgendados(desde: Date, ate: Date): Promise<AtendimentoAgenda[]> {
    const { rows } = await this.pool.query(
      `SELECT a.id,
              a.profissional_id AS "profissionalId",
              COALESCE(a.paciente_id::text, a.paciente_tea_id::text) AS "pacienteId",
              a.paciente_tea_id IS NOT NULL AS "isTea",
              COALESCE(p.nome_beneficiario, pt.nome_completo, 'Paciente') AS "pacienteNome",
              a.data_inicio AS "dataInicio",
              a.tipo
         FROM atendimentos a
         LEFT JOIN pacientes p ON p.id = a.paciente_id
         LEFT JOIN pacientes_tea pt ON pt.id = a.paciente_tea_id
        WHERE a.status = 'agendado'
          AND a.data_inicio >= $1
          AND a.data_inicio < $2
        ORDER BY a.data_inicio`,
      [desde, ate],
    );
    return rows;
  }

  async listarIdsDecididos(): Promise<Set<string>> {
    const { rows } = await this.pool.query(
      'SELECT sugestao_id AS "sugestaoId" FROM decisoes_sugestoes',
    );
    return new Set(rows.map((row: { sugestaoId: string }) => row.sugestaoId));
  }

  // Atendimentos mantidos ao modificar ou descartar uma redução de frequência
  async listarAtendimentosMantidos(): Promise<Set<string>> {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT unnest(atendimentos_mantidos)::text AS id
         FROM decisoes_sugestoes`,
    );
    return new Set(rows.map((row: { id: string }) => row.id));
  }

  // Devolve null se a sugestão já tinha sido decidida (evita aprovar duas vezes)
  async registrarDecisao(
    decisao: NovaDecisao,
  ): Promise<DecisaoRegistrada | null> {
    const { rows } = await this.pool.query(
      `INSERT INTO decisoes_sugestoes
         (sugestao_id, tipo, titulo, decisao, motivo, profissionais, decidido_por, ajuste,
          atendimentos_mantidos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (sugestao_id) DO NOTHING
       RETURNING ${PROJECAO_DECISAO}`,
      [
        decisao.sugestaoId,
        decisao.tipo,
        decisao.titulo,
        decisao.decisao,
        decisao.motivo,
        decisao.profissionais,
        decisao.decididoPor,
        decisao.ajuste ?? null,
        decisao.atendimentosMantidos ?? [],
      ],
    );
    return rows[0] ?? null;
  }

  async removerDecisao(sugestaoId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM decisoes_sugestoes WHERE sugestao_id = $1',
      [sugestaoId],
    );
  }

  // Sem profissionalId, lista tudo (coordenação); com ele, só as decisões que o envolviam
  async listarHistorico(
    profissionalId?: string,
    limite = 50,
  ): Promise<DecisaoHistorico[]> {
    const valores: unknown[] = [limite];
    let filtro = '';
    if (profissionalId) {
      valores.push(profissionalId);
      filtro = 'WHERE $2 = ANY(d.profissionais)';
    }
    const { rows } = await this.pool.query(
      `SELECT d.id, d.sugestao_id AS "sugestaoId", d.tipo, d.titulo, d.decisao,
              d.motivo, d.ajuste, d.profissionais, d.decidido_por AS "decididoPor",
              d.decidido_em AS "decididoEm", pr.nome_completo AS "decididoPorNome"
         FROM decisoes_sugestoes d
         JOIN profissionais pr ON pr.id = d.decidido_por
        ${filtro}
        ORDER BY d.decidido_em DESC
        LIMIT $1`,
      valores,
    );
    return rows;
  }
}

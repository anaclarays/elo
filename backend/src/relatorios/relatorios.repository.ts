import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { ExecutorSql } from '../lista-espera/lista-espera.repository';

export interface Periodo {
  dataInicio: string | null;
  dataFim: string | null;
}

export interface LinhaPacientesAtivos {
  total: number;
  beneficiario: number;
  tea: number;
  crianca: number;
  adolescente: number;
  adulto: number;
  idoso: number;
  nivel1: number;
  nivel2: number;
  nivel3: number;
}

export interface LinhaPacientesCadastrados {
  beneficiario: number;
  tea: number;
}

export interface LinhaFilaAtual {
  total: number;
  beneficiario: number;
  tea: number;
  esperaMediaDias: number | null;
  maiorEsperaDias: number | null;
}

export interface LinhaMovimentoFila {
  entradas: number;
  saidasPorAgendamento: number;
  saidasManuais: number;
  esperaMediaAteAgendamentoDias: number | null;
}

export interface LinhaAtendimentos {
  total: number;
  agendados: number;
  cancelados: number;
  pacientesDistintos: number;
}

export interface LinhaPorTipo {
  tipo: string;
  total: number;
}

export interface LinhaPorProfissional {
  profissionalId: string;
  nome: string;
  total: number;
}

export interface LinhaProfissionaisPorArea {
  area: string;
  ativos: number;
  cadastradosNoPeriodo: number;
}

const FUSO = 'America/Recife';
const HOJE = `(now() AT TIME ZONE '${FUSO}')::date`;
const DIAS = (intervalo: string) =>
  `ROUND((EXTRACT(EPOCH FROM ${intervalo}) / 86400)::numeric, 1)::float8`;

// $1 = data inicial e $2 = data final (inclusivas); null deixa o lado em aberto
function noPeriodo(coluna: string, tipo: 'timestamp' | 'date'): string {
  const dia =
    tipo === 'timestamp' ? `(${coluna} AT TIME ZONE '${FUSO}')::date` : coluna;
  return `($1::date IS NULL OR ${dia} >= $1::date) AND ($2::date IS NULL OR ${dia} <= $2::date)`;
}

@Injectable()
export class RelatoriosRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // Transação somente leitura: o banco recusa qualquer alteração, e todas as
  // consultas do relatório enxergam o mesmo retrato dos dados
  async emLeitura<T>(
    consulta: (executor: ExecutorSql) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query(
        'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
      );
      const resultado = await consulta(client);
      await client.query('COMMIT');
      return resultado;
    } catch (erro) {
      await client.query('ROLLBACK');
      throw erro;
    } finally {
      client.release();
    }
  }

  async pacientesAtivos(executor: ExecutorSql): Promise<LinhaPacientesAtivos> {
    const resultado = await executor.query(
      `WITH ativos AS (
         SELECT 'beneficiario' AS tipo, data_nascimento, NULL::smallint AS nivel_suporte
         FROM pacientes WHERE ativo = true
         UNION ALL
         SELECT 'tea', data_nascimento, nivel_suporte
         FROM pacientes_tea WHERE ativo = true
       ),
       idades AS (
         SELECT tipo, nivel_suporte,
                date_part('year', age(${HOJE}, data_nascimento))::int AS idade
         FROM ativos
       )
       SELECT count(*)::int AS total,
              count(*) FILTER (WHERE tipo = 'beneficiario')::int AS beneficiario,
              count(*) FILTER (WHERE tipo = 'tea')::int AS tea,
              count(*) FILTER (WHERE idade <= 11)::int AS crianca,
              count(*) FILTER (WHERE idade BETWEEN 12 AND 17)::int AS adolescente,
              count(*) FILTER (WHERE idade BETWEEN 18 AND 59)::int AS adulto,
              count(*) FILTER (WHERE idade >= 60)::int AS idoso,
              count(*) FILTER (WHERE nivel_suporte = 1)::int AS nivel1,
              count(*) FILTER (WHERE nivel_suporte = 2)::int AS nivel2,
              count(*) FILTER (WHERE nivel_suporte = 3)::int AS nivel3
       FROM idades`,
    );
    return resultado.rows[0] as LinhaPacientesAtivos;
  }

  async pacientesCadastrados(
    executor: ExecutorSql,
    periodo: Periodo,
  ): Promise<LinhaPacientesCadastrados> {
    const resultado = await executor.query(
      `SELECT
         (SELECT count(*) FROM pacientes
          WHERE ativo = true AND ${noPeriodo('data_cadastro', 'timestamp')})::int AS beneficiario,
         (SELECT count(*) FROM pacientes_tea
          WHERE ativo = true AND ${noPeriodo('data_cadastro', 'date')})::int AS tea`,
      [periodo.dataInicio, periodo.dataFim],
    );
    return resultado.rows[0] as LinhaPacientesCadastrados;
  }

  // Mesmos critérios da consulta da lista de espera, para os números baterem com a tela
  async filaAtual(executor: ExecutorSql): Promise<LinhaFilaAtual> {
    const resultado = await executor.query(
      `WITH fila AS (
         SELECT le.paciente_tea_id IS NOT NULL AS tea, le.data_entrada
         FROM lista_espera le
         LEFT JOIN pacientes p ON p.id = le.paciente_id AND p.ativo = true
         LEFT JOIN pacientes_tea pt ON pt.id = le.paciente_tea_id AND pt.ativo = true
         WHERE le.data_saida IS NULL
           AND (p.id IS NOT NULL OR pt.id IS NOT NULL)
       )
       SELECT count(*)::int AS total,
              count(*) FILTER (WHERE NOT tea)::int AS beneficiario,
              count(*) FILTER (WHERE tea)::int AS tea,
              ${DIAS('AVG(now() - data_entrada)')} AS "esperaMediaDias",
              ${DIAS('MAX(now() - data_entrada)')} AS "maiorEsperaDias"
       FROM fila`,
    );
    return resultado.rows[0] as LinhaFilaAtual;
  }

  async movimentoFila(
    executor: ExecutorSql,
    periodo: Periodo,
  ): Promise<LinhaMovimentoFila> {
    const saidaNoPeriodo = noPeriodo('data_saida', 'timestamp');
    const resultado = await executor.query(
      `SELECT
         count(*) FILTER (WHERE ${noPeriodo('data_entrada', 'timestamp')})::int AS entradas,
         count(*) FILTER (WHERE motivo_saida = 'agendamento' AND ${saidaNoPeriodo})::int AS "saidasPorAgendamento",
         count(*) FILTER (WHERE motivo_saida = 'manual' AND ${saidaNoPeriodo})::int AS "saidasManuais",
         ${DIAS(`AVG(data_saida - data_entrada) FILTER (WHERE motivo_saida = 'agendamento' AND ${saidaNoPeriodo})`)} AS "esperaMediaAteAgendamentoDias"
       FROM lista_espera`,
      [periodo.dataInicio, periodo.dataFim],
    );
    return resultado.rows[0] as LinhaMovimentoFila;
  }

  async atendimentos(
    executor: ExecutorSql,
    periodo: Periodo,
  ): Promise<LinhaAtendimentos> {
    const resultado = await executor.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'agendado')::int AS agendados,
              count(*) FILTER (WHERE status = 'cancelado')::int AS cancelados,
              count(DISTINCT COALESCE(paciente_id::text, paciente_tea_id::text))
                FILTER (WHERE status = 'agendado')::int AS "pacientesDistintos"
       FROM atendimentos
       WHERE ${noPeriodo('data_inicio', 'timestamp')}`,
      [periodo.dataInicio, periodo.dataFim],
    );
    return resultado.rows[0] as LinhaAtendimentos;
  }

  // Lista todos os tipos, inclusive os que não tiveram atendimento no período
  async atendimentosPorTipo(
    executor: ExecutorSql,
    periodo: Periodo,
  ): Promise<LinhaPorTipo[]> {
    const resultado = await executor.query(
      `SELECT t::text AS tipo, count(a.id)::int AS total
       FROM unnest(enum_range(NULL::tipo_atendimento)) AS t
       LEFT JOIN atendimentos a
         ON a.tipo = t AND a.status = 'agendado'
        AND ${noPeriodo('a.data_inicio', 'timestamp')}
       GROUP BY t
       ORDER BY t`,
      [periodo.dataInicio, periodo.dataFim],
    );
    return resultado.rows as LinhaPorTipo[];
  }

  async atendimentosPorProfissional(
    executor: ExecutorSql,
    periodo: Periodo,
  ): Promise<LinhaPorProfissional[]> {
    const resultado = await executor.query(
      `SELECT pr.id AS "profissionalId", pr.nome_completo AS nome, count(*)::int AS total
       FROM atendimentos a
       JOIN profissionais pr ON pr.id = a.profissional_id
       WHERE a.status = 'agendado'
         AND ${noPeriodo('a.data_inicio', 'timestamp')}
       GROUP BY pr.id, pr.nome_completo
       ORDER BY total DESC, nome`,
      [periodo.dataInicio, periodo.dataFim],
    );
    return resultado.rows as LinhaPorProfissional[];
  }

  async profissionaisPorArea(
    executor: ExecutorSql,
    periodo: Periodo,
  ): Promise<LinhaProfissionaisPorArea[]> {
    const resultado = await executor.query(
      `SELECT area_atuacao::text AS area,
              count(*)::int AS ativos,
              count(*) FILTER (WHERE ${noPeriodo('created_at', 'timestamp')})::int AS "cadastradosNoPeriodo"
       FROM profissionais
       WHERE ativo = true
       GROUP BY area_atuacao`,
      [periodo.dataInicio, periodo.dataFim],
    );
    return resultado.rows as LinhaProfissionaisPorArea[];
  }
}

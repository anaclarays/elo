import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import {
  MotivoSaida,
  PacienteRef,
  TipoPaciente,
} from './enum/lista-espera.enum';

// Pool ou client de uma transação já aberta (ex.: o cadastro de paciente TEA)
export interface ExecutorSql {
  query: (sql: string, valores?: unknown[]) => Promise<{ rows: any[] }>;
}

export interface RegistroListaEspera {
  id: string;
  tipoPaciente: TipoPaciente;
  pacienteId: string;
  dataEntrada: Date;
  dataSaida: Date | null;
  motivoSaida: MotivoSaida | null;
  justificativa: string | null;
  retiradoPor: string | null;
}

export interface ItemFila {
  id: string;
  posicao: number;
  dataEntrada: Date;
  tipoPaciente: TipoPaciente;
  pacienteId: string;
  numeroCadastro: string;
  nome: string;
  cpf: string;
  dataNascimento: string;
  dataCadastro: string;
}

export interface FiltrosFila {
  tipo?: TipoPaciente;
  nome?: string;
}

// Nomes fixos de tabela/coluna por tipo de paciente (nunca vêm do usuário)
const ORIGEM: Record<TipoPaciente, { tabela: string; coluna: string }> = {
  [TipoPaciente.BENEFICIARIO]: { tabela: 'pacientes', coluna: 'paciente_id' },
  [TipoPaciente.TEA]: { tabela: 'pacientes_tea', coluna: 'paciente_tea_id' },
};

const PROJECAO_REGISTRO = [
  'id',
  `CASE WHEN paciente_tea_id IS NULL THEN 'beneficiario' ELSE 'tea' END AS "tipoPaciente"`,
  'COALESCE(paciente_id::text, paciente_tea_id::text) AS "pacienteId"',
  'data_entrada AS "dataEntrada"',
  'data_saida AS "dataSaida"',
  'motivo_saida AS "motivoSaida"',
  'justificativa',
  'retirado_por AS "retiradoPor"',
].join(', ');

@Injectable()
export class ListaEsperaRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async registrar(
    paciente: PacienteRef,
    executor: ExecutorSql = this.pool,
  ): Promise<RegistroListaEspera> {
    const { coluna } = ORIGEM[paciente.tipo];
    const resultado = await executor.query(
      `INSERT INTO lista_espera (${coluna}) VALUES ($1) RETURNING ${PROJECAO_REGISTRO}`,
      [paciente.id],
    );
    return resultado.rows[0] as RegistroListaEspera;
  }

  async pacienteAtivoExiste(paciente: PacienteRef): Promise<boolean> {
    const { tabela } = ORIGEM[paciente.tipo];
    const resultado = await this.pool.query(
      `SELECT 1 FROM ${tabela} WHERE id = $1 AND ativo = true`,
      [paciente.id],
    );
    return resultado.rows.length > 0;
  }

  async existeRegistroAtivo(paciente: PacienteRef): Promise<boolean> {
    const { coluna } = ORIGEM[paciente.tipo];
    const resultado = await this.pool.query(
      `SELECT 1 FROM lista_espera WHERE ${coluna} = $1 AND data_saida IS NULL`,
      [paciente.id],
    );
    return resultado.rows.length > 0;
  }

  // RN30 + RN34 + RN32: a posição é calculada na hora da consulta, pela ordem de
  // chegada, sobre a fila inteira (antes dos filtros). Assim ela nunca fica
  // desatualizada quando alguém entra ou sai da lista.
  async listarFila(filtros: FiltrosFila = {}): Promise<ItemFila[]> {
    const condicoes: string[] = [];
    const valores: unknown[] = [];

    if (filtros.tipo) {
      valores.push(filtros.tipo);
      condicoes.push(`"tipoPaciente" = $${valores.length}`);
    }
    if (filtros.nome?.trim()) {
      valores.push(`%${filtros.nome.trim()}%`);
      condicoes.push(`nome ILIKE $${valores.length}`);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    const resultado = await this.pool.query(
      `WITH fila AS (
         SELECT le.id,
                ROW_NUMBER() OVER (ORDER BY le.data_entrada, le.id)::int AS posicao,
                le.data_entrada AS "dataEntrada",
                CASE WHEN le.paciente_tea_id IS NULL THEN 'beneficiario' ELSE 'tea' END AS "tipoPaciente",
                COALESCE(p.id::text, pt.id::text) AS "pacienteId",
                COALESCE(p.numero_cadastro, pt.numero_cadastro::text) AS "numeroCadastro",
                COALESCE(p.nome_beneficiario, pt.nome_completo) AS nome,
                COALESCE(p.cpf::text, pt.cpf::text) AS cpf,
                COALESCE(p.data_nascimento, pt.data_nascimento) AS "dataNascimento",
                COALESCE((p.data_cadastro AT TIME ZONE 'America/Recife')::date, pt.data_cadastro) AS "dataCadastro"
         FROM lista_espera le
         LEFT JOIN pacientes p ON p.id = le.paciente_id AND p.ativo = true
         LEFT JOIN pacientes_tea pt ON pt.id = le.paciente_tea_id AND pt.ativo = true
         WHERE le.data_saida IS NULL
           AND (p.id IS NOT NULL OR pt.id IS NOT NULL)
       )
       SELECT * FROM fila ${where} ORDER BY posicao`,
      valores,
    );
    return resultado.rows as ItemFila[];
  }

  // Encerra um registro ativo pelo id do registro (retirada manual, RN33)
  async encerrar(
    id: string,
    motivo: MotivoSaida,
    detalhes: { justificativa?: string; retiradoPor?: string } = {},
  ): Promise<RegistroListaEspera | null> {
    const resultado = await this.pool.query(
      `UPDATE lista_espera
       SET data_saida = now(), motivo_saida = $2, justificativa = $3,
           retirado_por = $4, updated_at = now()
       WHERE id = $1 AND data_saida IS NULL
       RETURNING ${PROJECAO_REGISTRO}`,
      [
        id,
        motivo,
        detalhes.justificativa ?? null,
        detalhes.retiradoPor ?? null,
      ],
    );
    return (resultado.rows[0] as RegistroListaEspera | undefined) ?? null;
  }

  // Encerra o registro ativo de um paciente, se houver (saída por agendamento, RN29)
  async encerrarPorPaciente(
    paciente: PacienteRef,
    motivo: MotivoSaida,
    executor: ExecutorSql = this.pool,
  ): Promise<boolean> {
    const { coluna } = ORIGEM[paciente.tipo];
    const resultado = await executor.query(
      `UPDATE lista_espera
       SET data_saida = now(), motivo_saida = $2, updated_at = now()
       WHERE ${coluna} = $1 AND data_saida IS NULL
       RETURNING id`,
      [paciente.id, motivo],
    );
    return resultado.rows.length > 0;
  }
}

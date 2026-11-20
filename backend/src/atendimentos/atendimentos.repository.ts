import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { ExecutorSql } from '../lista-espera/lista-espera.repository';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';

type AtendimentoPersistido = Omit<CreateAtendimentoDto, 'isTea'>;
type AtendimentoCamposComuns = Omit<AtendimentoPersistido, 'pacienteId'>;

type AtendimentoParaGravar = Pick<
  CreateAtendimentoDto,
  'pacienteId' | 'profissionalId' | 'dataInicio' | 'tipo' | 'isTea'
>;

export interface AtendimentoRecord extends AtendimentoPersistido {
  id: string;
  dataFim: Date;
  isTea: boolean;
}

const ATENDIMENTO_COLUMNS = {
  profissionalId: 'profissional_id',
  dataInicio: 'data_inicio',
  tipo: 'tipo',
} as const satisfies Record<keyof AtendimentoCamposComuns, string>;

const ATENDIMENTO_FIELDS = Object.keys(
  ATENDIMENTO_COLUMNS,
) as (keyof AtendimentoCamposComuns)[];

const ATENDIMENTO_PROJECTION = [
  'id',
  `data_inicio + INTERVAL '20 minutes' AS "dataFim"`,
  `COALESCE(paciente_id::text, paciente_tea_id::text) AS "pacienteId"`,
  `paciente_tea_id IS NOT NULL AS "isTea"`,
  ...ATENDIMENTO_FIELDS.map(
    (field) => `${ATENDIMENTO_COLUMNS[field]} AS "${field}"`,
  ),
].join(', ');

@Injectable()
export class AtendimentosRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async emTransacao<T>(
    operacao: (client: ExecutorSql) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const resultado = await operacao(client);
      await client.query('COMMIT');
      return resultado;
    } catch (erro) {
      await client.query('ROLLBACK');
      throw erro;
    } finally {
      client.release();
    }
  }

  async create(
    atendimento: AtendimentoParaGravar,
    executor: ExecutorSql = this.pool,
  ): Promise<AtendimentoRecord> {
    const pacienteColumn = atendimento.isTea
      ? 'paciente_tea_id'
      : 'paciente_id';

    const columns = [
      pacienteColumn,
      ...ATENDIMENTO_FIELDS.map((field) => ATENDIMENTO_COLUMNS[field]),
    ];

    const values = [
      atendimento.pacienteId,
      ...ATENDIMENTO_FIELDS.map((field) => atendimento[field]),
    ];

    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await executor.query(
      `INSERT INTO atendimentos (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING ${ATENDIMENTO_PROJECTION}`,
      values,
    );

    if (!result.rows[0]) {
      throw new Error(
        'A criação do atendimento não retornou o registro inserido.',
      );
    }

    return result.rows[0] as AtendimentoRecord;
  }

  async findAll(): Promise<AtendimentoRecord[]> {
    const result = await this.pool.query(
      `SELECT ${ATENDIMENTO_PROJECTION} FROM atendimentos ORDER BY data_inicio DESC, id DESC`,
    );
    return result.rows as AtendimentoRecord[];
  }

  async findOne(id: string): Promise<AtendimentoRecord | null> {
    const result = await this.pool.query(
      `SELECT ${ATENDIMENTO_PROJECTION} FROM atendimentos WHERE id = $1`,
      [id],
    );
    return (result.rows[0] as AtendimentoRecord | undefined) ?? null;
  }

  async update(
    id: string,
    atendimento: AtendimentoParaGravar,
    executor: ExecutorSql = this.pool,
  ): Promise<AtendimentoRecord | null> {
    const pacienteColumn = atendimento.isTea
      ? 'paciente_tea_id'
      : 'paciente_id';

    const outraPacienteColumn = atendimento.isTea
      ? 'paciente_id'
      : 'paciente_tea_id';

    const result = await executor.query(
      `UPDATE atendimentos
      SET ${pacienteColumn} = $1,
          ${outraPacienteColumn} = NULL,
          profissional_id = $2,
          data_inicio = $3,
          tipo = $4
      WHERE id = $5
      RETURNING ${ATENDIMENTO_PROJECTION}`,
      [
        atendimento.pacienteId,
        atendimento.profissionalId,
        atendimento.dataInicio,
        atendimento.tipo,
        id,
      ],
    );

    return (result.rows[0] as AtendimentoRecord | undefined) ?? null;
  }

  async remove(id: string) {
    const result = await this.pool.query(
      'DELETE FROM atendimentos WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rows.length > 0;
  }

  async hasTimeConflict(
    outroId: number | string,
    novaDataInicio: Date,
    pessoa: 'profissional' | 'paciente' | 'paciente_tea',
    ignorarAtendimentoId?: string,
  ): Promise<boolean> {
    const values: (number | string | Date)[] = [outroId, novaDataInicio];
    let ignorarAtendimento = '';

    // Na atualização, o próprio atendimento não conta como conflito
    if (ignorarAtendimentoId !== undefined) {
      values.push(ignorarAtendimentoId);
      ignorarAtendimento = `AND id <> $${values.length}`;
    }

    const result = await this.pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM atendimentos
        WHERE ${pessoa}_id = $1
          AND data_inicio < $2::timestamptz + INTERVAL '20 minutes'
          AND data_inicio + INTERVAL '20 minutes' > $2::timestamptz
          ${ignorarAtendimento}
      ) AS conflito_horario`,
      values,
    );
    return result.rows[0].conflito_horario;
  }

  async isPacienteAtivo(
    pacienteId: number | string,
    isTea: boolean,
  ): Promise<boolean> {
    const tabela = isTea ? 'pacientes_tea' : 'pacientes';
    const result = await this.pool.query(
      `SELECT 1 FROM ${tabela} WHERE id = $1 AND ativo = true`,
      [pacienteId],
    );
    return result.rows.length > 0;
  }
}

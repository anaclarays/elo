import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from './dto/update-atendimento.dto';

export interface AtendimentoRecord extends CreateAtendimentoDto {
  id: number;
  dataFim: Date;
}

type CreateAtendimentoRecord = CreateAtendimentoDto;

const ATENDIMENTO_COLUMNS = {
  pacienteId: 'paciente_id',
  profissionalId: 'profissional_id',
  dataInicio: 'data_inicio',
  tipo: 'tipo',
} as const satisfies Record<keyof CreateAtendimentoDto, string>;

const ATENDIMENTO_FIELDS = Object.keys(
  ATENDIMENTO_COLUMNS,
) as (keyof CreateAtendimentoDto)[];

const ATENDIMENTO_PROJECTION = [
  'id',
  `data_inicio + INTERVAL '20 minutes' AS "dataFim"`,
  ...ATENDIMENTO_FIELDS.map(
    (field) => `${ATENDIMENTO_COLUMNS[field]} AS "${field}"`,
  ),
].join(', ');

@Injectable()
export class AtendimentosRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(
    atendimento: CreateAtendimentoRecord,
  ): Promise<AtendimentoRecord> {
    const columns = [
      ...ATENDIMENTO_FIELDS.map((field) => ATENDIMENTO_COLUMNS[field]),
    ];
    const values = [
      ...ATENDIMENTO_FIELDS.map((field) => atendimento[field] ?? null),
    ];
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await this.pool.query(
      `INSERT INTO atendimentos (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${ATENDIMENTO_PROJECTION}`,
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

  async findOne(id: number): Promise<AtendimentoRecord | null> {
    const result = await this.pool.query(
      `SELECT ${ATENDIMENTO_PROJECTION} FROM atendimentos WHERE id = $1`,
      [id],
    );
    return (result.rows[0] as AtendimentoRecord | undefined) ?? null;
  }

  async update(
    id: number,
    atendimento: UpdateAtendimentoDto,
  ): Promise<AtendimentoRecord | null> {
    const fields = ATENDIMENTO_FIELDS.filter(
      (field) => atendimento[field] !== undefined,
    );

    const values: (string | number | Date | null)[] = [];

    const assignments = fields.map((field, index) => {
      const value = atendimento[field];
      if (value === undefined) {
        throw new Error(`O campo ${field} não possui valor para atualização.`);
      }
      values.push(value);
      return `${ATENDIMENTO_COLUMNS[field]} = $${index + 1}`;
    });
    
    values.push(id);
    const result = await this.pool.query(
      `UPDATE atendimentos SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING ${ATENDIMENTO_PROJECTION}`,
      values,
    );
    return (result.rows[0] as AtendimentoRecord | undefined) ?? null;
  }

  async remove(id: number) {
    const result = await this.pool.query(
      'DELETE FROM atendimentos WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rows.length > 0;
  }

  async hasTimeConflict(
    outroId: number | string,
    novaDataInicio: Date,
    pessoa: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM atendimentos
        WHERE ${pessoa}_id = $1
          AND data_inicio < $2::timestamptz + INTERVAL '20 minutes'
          AND data_inicio + INTERVAL '20 minutes' > $2::timestamptz
      ) AS conflito_horario`,
      [outroId, novaDataInicio],
    );
    return result.rows[0].conflito_horario;
  }
}

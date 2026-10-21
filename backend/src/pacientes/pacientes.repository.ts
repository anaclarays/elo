import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { CreateBeneficiarioDto } from './dto/create-paciente.dto';

export interface PacienteRecord extends CreateBeneficiarioDto {
  id: number;
  dataCadastro: string;
  ativo: boolean;
}

type CreatePacienteRecord = CreateBeneficiarioDto & { dataCadastro: string };

const PACIENTE_COLUMNS = {
  numeroCadastro: 'numero_cadastro',
  nomeBeneficiario: 'nome_beneficiario',
  dataNascimento: 'data_nascimento',
  rg: 'rg',
  cpf: 'cpf',
  nomeMae: 'nome_mae',
  endereco: 'endereco',
  numero: 'numero',
  bairro: 'bairro',
  cidade: 'cidade',
  cep: 'cep',
  estado: 'estado',
  contato: 'contato',
  email: 'email',
  possuiIrmaos: 'possui_irmaos',
  quantidadeIrmaos: 'quantidade_irmaos',
  nomesIrmaos: 'nomes_irmaos',
  escolaFrequenta: 'escola_frequenta',
  serie: 'serie',
  possuiDeficit: 'possui_deficit',
  queixa: 'queixa',
  fazAcompanhamento: 'faz_acompanhamento',
  quaisAcompanhamentos: 'quais_acompanhamentos',
  fazUsoMedicacao: 'faz_uso_medicacao',
  quaisMedicacoes: 'quais_medicacoes',
  nomePai: 'nome_pai',
  acompanhanteEscolar: 'acompanhante_escolar',
} as const satisfies Record<keyof CreateBeneficiarioDto, string>;

const PACIENTE_FIELDS = Object.keys(
  PACIENTE_COLUMNS,
) as (keyof CreateBeneficiarioDto)[];
const PACIENTE_PROJECTION = [
  'id',
  'data_cadastro AS "dataCadastro"',
  'ativo',
  ...PACIENTE_FIELDS.filter((field) => field !== 'numeroCadastro').map(
    (field) => `${PACIENTE_COLUMNS[field]} AS "${field}"`,
  ),
  'numero_cadastro AS "numeroCadastro"',
].join(', ');

@Injectable()
export class PacientesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(paciente: CreatePacienteRecord): Promise<PacienteRecord> {
    const columns = [
      'data_cadastro',
      ...PACIENTE_FIELDS.map((field) => PACIENTE_COLUMNS[field]),
    ];
    const values = [
      paciente.dataCadastro,
      ...PACIENTE_FIELDS.map((field) => paciente[field] ?? null),
    ];
    const placeholders = values.map((_, index) => `$${index + 1}`);
    const result = await this.pool.query(
      `INSERT INTO pacientes (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${PACIENTE_PROJECTION}`,
      values,
    );

    if (!result.rows[0]) {
      throw new Error(
        'A criação do paciente não retornou o registro inserido.',
      );
    }

    return result.rows[0] as PacienteRecord;
  }

  async findAll(): Promise<PacienteRecord[]> {
    const result = await this.pool.query(
      `SELECT ${PACIENTE_PROJECTION} FROM pacientes WHERE ativo = true ORDER BY data_cadastro DESC, id DESC`,
    );
    return result.rows as PacienteRecord[];
  }

  async findOne(id: number): Promise<PacienteRecord | null> {
    const result = await this.pool.query(
      `SELECT ${PACIENTE_PROJECTION} FROM pacientes WHERE id = $1 AND ativo = true`,
      [id],
    );
    return (result.rows[0] as PacienteRecord | undefined) ?? null;
  }

  async update(
    id: number,
    paciente: Partial<CreateBeneficiarioDto>,
  ): Promise<PacienteRecord | null> {
    const fields = PACIENTE_FIELDS.filter(
      (field) => paciente[field] !== undefined,
    );
    const values: (string | number | boolean | null)[] = [];
    const assignments = fields.map((field, index) => {
      const value = paciente[field];
      if (value === undefined) {
        throw new Error(`O campo ${field} não possui valor para atualização.`);
      }
      values.push(value);
      return `${PACIENTE_COLUMNS[field]} = $${index + 1}`;
    });

    values.push(id);
    const result = await this.pool.query(
      `UPDATE pacientes SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING ${PACIENTE_PROJECTION}`,
      values,
    );
    return (result.rows[0] as PacienteRecord | undefined) ?? null;
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE pacientes SET ativo = false, updated_at = now() WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rows.length > 0;
  }
}

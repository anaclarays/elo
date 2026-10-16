import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { PG_POOL } from '../database/database.constants';
import { CreateProfissionalDto } from './dto/create-profissional.dto';
import { UpdateProfissionalDto } from './dto/update-profissional.dto';

@Injectable()
export class ProfissionaisService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(dto: CreateProfissionalDto) {
    // RN11: prevenção de duplicidade (por CPF e por e-mail)
    const existente = await this.pool.query(
      `SELECT id FROM profissionais WHERE cpf = $1 OR email = $2`,
      [dto.cpf, dto.email],
    );
    if (existente.rows.length > 0) {
      throw new ConflictException('Já existe um profissional com este CPF ou e-mail');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 10);

    const result = await this.pool.query(
      `INSERT INTO profissionais
        (nome_completo, cpf, telefone, email, area_atuacao, cargo, senha_hash,
         capacidade_semanal, horario_atendimento, status, telefone_atendimento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, nome_completo, cpf, telefone, email, area_atuacao, cargo,
                 capacidade_semanal, horario_atendimento, status, telefone_atendimento,
                 ativo, created_at`,
      [
        dto.nomeCompleto,
        dto.cpf,
        dto.telefone,
        dto.email,
        dto.areaAtuacao,
        dto.cargo,
        senhaHash,
        dto.capacidadeSemanal ?? null,
        dto.horarioAtendimento ?? null,
        dto.status ?? null,
        dto.telefoneAtendimento ?? null,
      ],
    );

    return result.rows[0]; 
  }

  async findAll() {
    const result = await this.pool.query(
      `SELECT id, nome_completo, cpf, telefone, email, area_atuacao, cargo,
              capacidade_semanal, horario_atendimento, status, telefone_atendimento,
              ativo, created_at, updated_at
       FROM profissionais
       WHERE ativo = true
       ORDER BY nome_completo`,
    );
    return result.rows;
  }

  async findOne(id: string) {
    const result = await this.pool.query(
      `SELECT id, nome_completo, cpf, telefone, email, area_atuacao, cargo,
              capacidade_semanal, horario_atendimento, status, telefone_atendimento,
              ativo, created_at, updated_at
       FROM profissionais WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException('Profissional não encontrado');
    }
    return result.rows[0];
  }

  async update(id: string, dto: UpdateProfissionalDto) {
    await this.findOne(id); // garantir que existe 

    // Se o CPF ou e-mail forem alterados, verificar duplicidade de novo
    if (dto.cpf || dto.email) {
      const conflito = await this.pool.query(
        `SELECT id FROM profissionais WHERE (cpf = $1 OR email = $2) AND id != $3`,
        [dto.cpf ?? '', dto.email ?? '', id],
      );
      if (conflito.rows.length > 0) {
        throw new ConflictException('CPF ou e-mail já utilizado por outro profissional');
      }
    }

    const result = await this.pool.query(
      `UPDATE profissionais SET
        nome_completo = COALESCE($1, nome_completo),
        cpf = COALESCE($2, cpf),
        telefone = COALESCE($3, telefone),
        email = COALESCE($4, email),
        area_atuacao = COALESCE($5, area_atuacao),
        cargo = COALESCE($6, cargo),
        capacidade_semanal = COALESCE($7, capacidade_semanal),
        horario_atendimento = COALESCE($8, horario_atendimento),
        status = COALESCE($9, status),
        telefone_atendimento = COALESCE($10, telefone_atendimento),
        updated_at = now()
       WHERE id = $11
       RETURNING id, nome_completo, cpf, telefone, email, area_atuacao, cargo,
                 capacidade_semanal, horario_atendimento, status, telefone_atendimento,
                 ativo, updated_at`,
      [
        dto.nomeCompleto ?? null,
        dto.cpf ?? null,
        dto.telefone ?? null,
        dto.email ?? null,
        dto.areaAtuacao ?? null,
        dto.cargo ?? null,
        dto.capacidadeSemanal ?? null,
        dto.horarioAtendimento ?? null,
        dto.status ?? null,
        dto.telefoneAtendimento ?? null,
        id,
      ],
    );

    return result.rows[0];
  }

  async remove(id: string) {
    await this.findOne(id); // garantir que existe antes de "remover"

    // Soft delete: mantém a linha (preserva vínculo com atendimentos/dados),
    // só marca como inativo.
    await this.pool.query(
      `UPDATE profissionais SET ativo = false, updated_at = now() WHERE id = $1`,
      [id],
    );

    return { message: 'Profissional removido com sucesso' };
  }
}
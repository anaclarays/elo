import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.constants';
import { FiltrosHistoricoDto } from '../dto/filtros-historico.dto';

type ColunaPaciente = 'paciente_id' | 'paciente_tea_id';

// Maior valor de uma coluna INTEGER no Postgres
const MAIOR_ID_INTEIRO = 2147483647;

// Dados de identificação do paciente (só cadastros ativos)
const SQL_PACIENTE = `SELECT id, numero_cadastro AS "numeroCadastro", nome_beneficiario AS nome
  FROM pacientes WHERE id = $1 AND ativo = true`;
const SQL_PACIENTE_TEA = `SELECT id, numero_cadastro AS "numeroCadastro", nome_completo AS nome
  FROM pacientes_tea WHERE id = $1 AND ativo = true`;

@Injectable()
export class HistoricoClinicoService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // Histórico de um paciente do cadastro de aprendizagem
  async listarPorPaciente(pacienteId: number, filtros: FiltrosHistoricoDto) {
    this.validarPeriodo(filtros);
    // Id fora do limite do INTEGER faria o banco dar erro: não existe paciente com esse id
    if (pacienteId < 1 || pacienteId > MAIOR_ID_INTEIRO) {
      throw new NotFoundException('Paciente não encontrado');
    }
    const paciente = await this.buscarPaciente(SQL_PACIENTE, pacienteId);
    const registros = await this.buscarRegistros(
      'paciente_id',
      pacienteId,
      filtros,
    );

    return {
      paciente: { origem: 'pacientes', ...paciente },
      total: registros.length,
      registros,
    };
  }

  // Histórico de um paciente do cadastro de TEA
  async listarPorPacienteTea(pacienteId: string, filtros: FiltrosHistoricoDto) {
    this.validarPeriodo(filtros);
    const paciente = await this.buscarPaciente(SQL_PACIENTE_TEA, pacienteId);
    const registros = await this.buscarRegistros(
      'paciente_tea_id',
      pacienteId,
      filtros,
    );

    return {
      paciente: { origem: 'pacientes-tea', ...paciente },
      total: registros.length,
      registros,
    };
  }

  // RN37: detalhes de um registro, com o profissional responsável e o paciente
  async buscarRegistro(id: string) {
    const resultado = await this.pool.query(
      `SELECT r.id, r.tipo, r.data_realizacao AS "dataRealizacao", r.titulo, r.descricao,
              r.avaliacoes, r.procedimentos, r.atendimento_id AS "atendimentoId",
              pr.id AS "profissionalId", pr.nome_completo AS "profissionalNome",
              pr.area_atuacao AS "profissionalArea",
              CASE WHEN r.paciente_tea_id IS NOT NULL THEN 'pacientes-tea' ELSE 'pacientes' END AS "origemPaciente",
              COALESCE(r.paciente_tea_id::text, r.paciente_id::text) AS "pacienteId",
              COALESCE(pt.nome_completo, p.nome_beneficiario) AS "pacienteNome"
       FROM registros_clinicos r
       JOIN profissionais pr ON pr.id = r.profissional_id
       LEFT JOIN pacientes p ON p.id = r.paciente_id
       LEFT JOIN pacientes_tea pt ON pt.id = r.paciente_tea_id
       WHERE r.id = $1 AND COALESCE(pt.ativo, p.ativo) = true`,
      [id],
    );
    if (resultado.rows.length === 0) {
      throw new NotFoundException('Registro clínico não encontrado');
    }
    return resultado.rows[0];
  }

  // ---------- auxiliares ----------
  private validarPeriodo({ dataInicio, dataFim }: FiltrosHistoricoDto) {
    if (dataInicio && dataFim && dataInicio > dataFim) {
      throw new BadRequestException(
        'dataInicio não pode ser posterior a dataFim',
      );
    }
  }

  private async buscarPaciente(sql: string, id: number | string) {
    const resultado = await this.pool.query(sql, [id]);
    if (resultado.rows.length === 0) {
      throw new NotFoundException('Paciente não encontrado');
    }
    return resultado.rows[0];
  }

  private async buscarRegistros(
    colunaPaciente: ColunaPaciente,
    pacienteId: number | string,
    filtros: FiltrosHistoricoDto,
  ) {
    const condicoes: string[] = [`r.${colunaPaciente} = $1`];
    const valores: (number | string)[] = [pacienteId];

    if (filtros.dataInicio) {
      valores.push(filtros.dataInicio);
      condicoes.push(`r.data_realizacao >= $${valores.length}`);
    }
    if (filtros.dataFim) {
      valores.push(filtros.dataFim);
      condicoes.push(`r.data_realizacao <= $${valores.length}`);
    }
    if (filtros.tipo) {
      valores.push(filtros.tipo);
      condicoes.push(`r.tipo = $${valores.length}`);
    }

    // Na lista, só o resumo. Os detalhes vêm em buscarRegistro
    const resultado = await this.pool.query(
      `SELECT r.id, r.tipo, r.data_realizacao AS "dataRealizacao", r.titulo,
              pr.id AS "profissionalId", pr.nome_completo AS "profissionalNome"
       FROM registros_clinicos r
       JOIN profissionais pr ON pr.id = r.profissional_id
       WHERE ${condicoes.join(' AND ')}
       ORDER BY r.data_realizacao DESC, r.created_at DESC`,
      valores,
    );
    return resultado.rows;
  }
}

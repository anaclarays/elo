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

  // RN37: detalhes de um registro, com o profissional, o paciente e, se houver, o atendimento vinculado
  async buscarRegistro(id: string) {
    const resultado = await this.pool.query(
      `SELECT r.id, r.tipo, r.data_realizacao AS "dataRealizacao", r.titulo, r.descricao,
              r.avaliacoes, r.procedimentos, r.atendimento_id AS "atendimentoId",
              CASE WHEN a.id IS NOT NULL THEN jsonb_build_object(
                'id', a.id, 'tipo', a.tipo, 'dataInicio', a.data_inicio, 'status', a.status
              ) END AS atendimento,
              pr.id AS "profissionalId", pr.nome_completo AS "profissionalNome",
              pr.area_atuacao AS "profissionalArea",
              CASE WHEN r.paciente_tea_id IS NOT NULL THEN 'pacientes-tea' ELSE 'pacientes' END AS "origemPaciente",
              COALESCE(r.paciente_tea_id::text, r.paciente_id::text) AS "pacienteId",
              COALESCE(pt.nome_completo, p.nome_beneficiario) AS "pacienteNome"
       FROM registros_clinicos r
       JOIN profissionais pr ON pr.id = r.profissional_id
       LEFT JOIN atendimentos a ON a.id = r.atendimento_id
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

  // RN35: junta os registros clínicos e os atendimentos da agenda que já aconteceram.
  // Depois aplica período (RN38) e tipo (RN39) sobre tudo e ordena do mais recente ao mais antigo.
  private async buscarRegistros(
    colunaPaciente: ColunaPaciente,
    pacienteId: number | string,
    filtros: FiltrosHistoricoDto,
  ) {
    const condicoes: string[] = [];
    const valores: (number | string)[] = [pacienteId];

    if (filtros.dataInicio) {
      valores.push(filtros.dataInicio);
      condicoes.push(`h."dataRealizacao" >= $${valores.length}`);
    }
    if (filtros.dataFim) {
      valores.push(filtros.dataFim);
      condicoes.push(`h."dataRealizacao" <= $${valores.length}`);
    }
    if (filtros.tipo) {
      valores.push(filtros.tipo);
      condicoes.push(`h.tipo = $${valores.length}`);
    }
    const filtro =
      condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';

    // Na lista, só o resumo (minimização de dados / LGPD). Os detalhes vêm em buscarRegistro.
    // "origem" diz onde abrir os detalhes: registro (histórico) ou atendimento (módulo da agenda).
    const resultado = await this.pool.query(
      `SELECT h.id, h.origem, h.tipo, h."dataRealizacao", h.titulo, h.status,
              h."profissionalId", h."profissionalNome"
       FROM (
         SELECT r.id, 'registro' AS origem, r.tipo::text AS tipo,
                r.data_realizacao AS "dataRealizacao", r.titulo, NULL::text AS status,
                pr.id AS "profissionalId", pr.nome_completo AS "profissionalNome",
                r.created_at AS ordem
         FROM registros_clinicos r
         JOIN profissionais pr ON pr.id = r.profissional_id
         WHERE r.${colunaPaciente} = $1
         UNION ALL
         SELECT a.id, 'atendimento' AS origem, 'atendimento' AS tipo,
                (a.data_inicio AT TIME ZONE 'America/Recife')::date AS "dataRealizacao",
                'Atendimento de ' || a.tipo::text AS titulo, a.status::text AS status,
                pr.id AS "profissionalId", pr.nome_completo AS "profissionalNome",
                a.data_inicio AS ordem
         FROM atendimentos a
         JOIN profissionais pr ON pr.id = a.profissional_id
         WHERE a.${colunaPaciente} = $1 AND a.data_inicio < now()
       ) h
       ${filtro}
       ORDER BY h."dataRealizacao" DESC, h.ordem DESC`,
      valores,
    );
    return resultado.rows;
  }
}

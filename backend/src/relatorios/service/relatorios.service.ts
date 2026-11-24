import { BadRequestException, Injectable } from '@nestjs/common';
import { ExecutorSql } from '../../lista-espera/lista-espera.repository';
import { AreaAtuacao } from '../../profissionais/dto/create-profissional.dto';
import { FiltroPeriodoDto } from '../dto/filtro-periodo.dto';
import { Periodo, RelatoriosRepository } from '../relatorios.repository';

@Injectable()
export class RelatoriosService {
  constructor(private readonly repository: RelatoriosRepository) {}

  async geral(filtro: FiltroPeriodoDto = {}) {
    const periodo = this.periodo(filtro);
    return this.repository.emLeitura(async (executor) => ({
      periodo,
      pacientes: await this.indicadoresPacientes(executor, periodo),
      listaEspera: await this.indicadoresListaEspera(executor, periodo),
      atendimentos: await this.indicadoresAtendimentos(executor, periodo),
      profissionais: await this.indicadoresProfissionais(executor, periodo),
    }));
  }

  pacientes(filtro: FiltroPeriodoDto = {}) {
    return this.secao(filtro, (executor, periodo) =>
      this.indicadoresPacientes(executor, periodo),
    );
  }

  listaEspera(filtro: FiltroPeriodoDto = {}) {
    return this.secao(filtro, (executor, periodo) =>
      this.indicadoresListaEspera(executor, periodo),
    );
  }

  atendimentos(filtro: FiltroPeriodoDto = {}) {
    return this.secao(filtro, (executor, periodo) =>
      this.indicadoresAtendimentos(executor, periodo),
    );
  }

  profissionais(filtro: FiltroPeriodoDto = {}) {
    return this.secao(filtro, (executor, periodo) =>
      this.indicadoresProfissionais(executor, periodo),
    );
  }

  private periodo(filtro: FiltroPeriodoDto): Periodo {
    const periodo = {
      dataInicio: filtro.dataInicio ?? null,
      dataFim: filtro.dataFim ?? null,
    };
    // Datas no formato AAAA-MM-DD podem ser comparadas como texto
    if (
      periodo.dataInicio &&
      periodo.dataFim &&
      periodo.dataInicio > periodo.dataFim
    ) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final',
      );
    }
    return periodo;
  }

  private async secao<T extends object>(
    filtro: FiltroPeriodoDto,
    indicadores: (executor: ExecutorSql, periodo: Periodo) => Promise<T>,
  ) {
    const periodo = this.periodo(filtro);
    const dados = await this.repository.emLeitura((executor) =>
      indicadores(executor, periodo),
    );
    return { periodo, ...dados };
  }

  private async indicadoresPacientes(executor: ExecutorSql, periodo: Periodo) {
    const ativos = await this.repository.pacientesAtivos(executor);
    const cadastrados = await this.repository.pacientesCadastrados(
      executor,
      periodo,
    );

    return {
      ativos: {
        total: ativos.total,
        beneficiario: ativos.beneficiario,
        tea: ativos.tea,
      },
      cadastradosNoPeriodo: {
        total: cadastrados.beneficiario + cadastrados.tea,
        beneficiario: cadastrados.beneficiario,
        tea: cadastrados.tea,
      },
      ativosPorFaixaEtaria: {
        crianca: ativos.crianca,
        adolescente: ativos.adolescente,
        adulto: ativos.adulto,
        idoso: ativos.idoso,
      },
      teaAtivosPorNivelSuporte: {
        nivel1: ativos.nivel1,
        nivel2: ativos.nivel2,
        nivel3: ativos.nivel3,
      },
    };
  }

  private async indicadoresListaEspera(
    executor: ExecutorSql,
    periodo: Periodo,
  ) {
    const fila = await this.repository.filaAtual(executor);
    const movimento = await this.repository.movimentoFila(executor, periodo);

    return {
      filaAtual: fila,
      noPeriodo: {
        entradas: movimento.entradas,
        saidas: {
          total: movimento.saidasPorAgendamento + movimento.saidasManuais,
          porAgendamento: movimento.saidasPorAgendamento,
          manuais: movimento.saidasManuais,
        },
        esperaMediaAteAgendamentoDias: movimento.esperaMediaAteAgendamentoDias,
      },
    };
  }

  private async indicadoresAtendimentos(
    executor: ExecutorSql,
    periodo: Periodo,
  ) {
    const totais = await this.repository.atendimentos(executor, periodo);
    const porTipo = await this.repository.atendimentosPorTipo(
      executor,
      periodo,
    );
    const porProfissional = await this.repository.atendimentosPorProfissional(
      executor,
      periodo,
    );

    return {
      total: totais.total,
      agendados: totais.agendados,
      cancelados: totais.cancelados,
      taxaCancelamentoPercentual:
        totais.total === 0
          ? null
          : Math.round((totais.cancelados / totais.total) * 1000) / 10,
      pacientesDistintos: totais.pacientesDistintos,
      porTipo,
      porProfissional,
    };
  }

  private async indicadoresProfissionais(
    executor: ExecutorSql,
    periodo: Periodo,
  ) {
    const linhas = await this.repository.profissionaisPorArea(
      executor,
      periodo,
    );

    // Áreas sem nenhum profissional também aparecem, com zero
    const porArea = Object.values(AreaAtuacao).map((area) => {
      const linha = linhas.find((l) => l.area === area);
      return {
        area,
        ativos: linha?.ativos ?? 0,
        cadastradosNoPeriodo: linha?.cadastradosNoPeriodo ?? 0,
      };
    });

    return {
      ativos: porArea.reduce((soma, area) => soma + area.ativos, 0),
      cadastradosNoPeriodo: porArea.reduce(
        (soma, area) => soma + area.cadastradosNoPeriodo,
        0,
      ),
      porArea,
    };
  }
}

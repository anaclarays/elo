import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AtendimentosService } from '../../atendimentos/service/atendimentos.service';
import { ListaEsperaService } from '../../lista-espera/service/lista-espera.service';
import {
  AcaoSugestao,
  gerarSugestoes,
  inicioDaSemana,
  LIMITES,
  Sugestao,
} from '../sugestoes.regras';
import { Decisao, SugestoesRepository } from '../sugestoes.repository';

const DIA = 24 * 60 * 60 * 1000;
const MOTIVO_REDUCAO =
  'Redução de frequência sugerida pelo sistema e aprovada pela coordenação';

@Injectable()
export class SugestoesService {
  constructor(
    private readonly repository: SugestoesRepository,
    private readonly atendimentosService: AtendimentosService,
    private readonly listaEsperaService: ListaEsperaService,
  ) {}

  async listar() {
    const agora = new Date();
    return {
      geradasEm: agora.toISOString(),
      sugestoes: await this.calcular(agora),
    };
  }

  historico() {
    return this.repository.listarHistorico();
  }

  async aprovar(id: string, usuarioId: string) {
    const sugestao = await this.buscarDisponivel(id);
    const decisao = await this.registrar(
      sugestao,
      Decisao.APROVADA,
      null,
      usuarioId,
    );

    // Se a ação falhar (ex.: alguém ocupou o horário), a sugestão volta para a lista
    try {
      const resultado = await this.executar(sugestao.acao);
      return { decisao, resultado };
    } catch (erro) {
      await this.repository.removerDecisao(id);
      throw erro;
    }
  }

  async descartar(id: string, motivo: string, usuarioId: string) {
    const sugestao = await this.buscarDisponivel(id);
    return this.registrar(sugestao, Decisao.DESCARTADA, motivo, usuarioId);
  }

  // As sugestões não ficam salvas: são recalculadas a partir da situação atual
  private async calcular(agora: Date): Promise<Sugestao[]> {
    const desde = inicioDaSemana(agora);
    const ate = new Date(
      Math.max(
        desde.getTime() + 14 * DIA,
        agora.getTime() + LIMITES.diasAnalisados * DIA,
      ),
    );
    const [profissionais, atendimentos, fila, decididas] = await Promise.all([
      this.repository.listarProfissionais(),
      this.repository.listarAgendados(desde, ate),
      this.listaEsperaService.consultar(),
      this.repository.listarIdsDecididos(),
    ]);
    return gerarSugestoes({
      agora,
      profissionais,
      atendimentos: atendimentos.map((a) => ({
        ...a,
        dataInicio: new Date(a.dataInicio),
      })),
      fila: fila.map((item) => ({
        id: item.id,
        posicao: Number(item.posicao),
        tipoPaciente: item.tipoPaciente,
        pacienteId: String(item.pacienteId),
        nome: item.nome,
        dataEntrada: new Date(item.dataEntrada),
      })),
      decididas,
    });
  }

  private async buscarDisponivel(id: string) {
    const sugestao = (await this.calcular(new Date())).find((s) => s.id === id);
    if (!sugestao) {
      throw new NotFoundException(
        'Esta sugestão não está mais disponível. Atualize a lista.',
      );
    }
    return sugestao;
  }

  private async registrar(
    sugestao: Sugestao,
    decisao: Decisao,
    motivo: string | null,
    usuarioId: string,
  ) {
    const registrada = await this.repository.registrarDecisao({
      sugestaoId: sugestao.id,
      tipo: sugestao.tipo,
      titulo: sugestao.titulo,
      decisao,
      motivo,
      decididoPor: usuarioId,
    });
    if (!registrada) {
      throw new ConflictException('Esta sugestão já foi decidida.');
    }
    return registrada;
  }

  // Usa as mesmas operações da agenda, com todas as validações dela
  private async executar(acao: AcaoSugestao) {
    switch (acao.tipo) {
      case 'transferir':
        return this.atendimentosService.update(acao.atendimentoId, {
          profissionalId: acao.profissionalId,
        });
      case 'agendar':
        return this.atendimentosService.create({
          pacienteId: acao.isTea ? acao.pacienteId : Number(acao.pacienteId),
          isTea: acao.isTea,
          profissionalId: acao.profissionalId,
          dataInicio: new Date(acao.dataInicio),
          tipo: acao.tipoAtendimento,
        });
      case 'cancelar': {
        const cancelados = [];
        for (const atendimentoId of acao.atendimentoIds) {
          cancelados.push(
            await this.atendimentosService.cancel(
              atendimentoId,
              MOTIVO_REDUCAO,
            ),
          );
        }
        return cancelados;
      }
    }
  }
}

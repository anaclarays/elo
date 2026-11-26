import {
  ConflictException,
  ForbiddenException,
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
  TipoSugestao,
} from '../sugestoes.regras';
import { Decisao, SugestoesRepository } from '../sugestoes.repository';

const DIA = 24 * 60 * 60 * 1000;
const MOTIVO_REDUCAO =
  'Redução de frequência sugerida pelo sistema e aprovada em Sugestões de IA';

export interface UsuarioSugestoes {
  id: string;
  coordenacao: boolean;
}

// A coordenação vê tudo; o voluntário vê as sugestões que mexem na agenda dele
function podeVer(sugestao: Sugestao, usuario: UsuarioSugestoes) {
  return usuario.coordenacao || sugestao.profissionais.includes(usuario.id);
}

// O voluntário decide as dele, mas não cancela atendimentos de outro profissional
function podeDecidir(sugestao: Sugestao, usuario: UsuarioSugestoes) {
  if (usuario.coordenacao) return true;
  if (!sugestao.profissionais.includes(usuario.id)) return false;
  return (
    sugestao.tipo !== TipoSugestao.REDUCAO_FREQUENCIA ||
    sugestao.profissionais.every((id) => id === usuario.id)
  );
}

@Injectable()
export class SugestoesService {
  constructor(
    private readonly repository: SugestoesRepository,
    private readonly atendimentosService: AtendimentosService,
    private readonly listaEsperaService: ListaEsperaService,
  ) {}

  async listar(usuario: UsuarioSugestoes) {
    const agora = new Date();
    const sugestoes = await this.calcular(agora);
    return {
      geradasEm: agora.toISOString(),
      sugestoes: sugestoes
        .filter((sugestao) => podeVer(sugestao, usuario))
        .map((sugestao) => ({
          ...sugestao,
          podeDecidir: podeDecidir(sugestao, usuario),
        })),
    };
  }

  historico(usuario: UsuarioSugestoes) {
    return this.repository.listarHistorico(
      usuario.coordenacao ? undefined : usuario.id,
    );
  }

  async aprovar(id: string, usuario: UsuarioSugestoes) {
    const sugestao = await this.buscarParaDecidir(id, usuario);
    const decisao = await this.registrar(
      sugestao,
      Decisao.APROVADA,
      null,
      usuario.id,
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

  async descartar(id: string, motivo: string, usuario: UsuarioSugestoes) {
    const sugestao = await this.buscarParaDecidir(id, usuario);
    return this.registrar(sugestao, Decisao.DESCARTADA, motivo, usuario.id);
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

  private async buscarParaDecidir(id: string, usuario: UsuarioSugestoes) {
    const sugestao = (await this.calcular(new Date())).find((s) => s.id === id);
    if (!sugestao || !podeVer(sugestao, usuario)) {
      throw new NotFoundException(
        'Esta sugestão não está mais disponível. Atualize a lista.',
      );
    }
    if (!podeDecidir(sugestao, usuario)) {
      throw new ForbiddenException(
        'Só a coordenação pode decidir esta sugestão, porque ela muda a agenda de outro profissional.',
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
      profissionais: sugestao.profissionais,
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

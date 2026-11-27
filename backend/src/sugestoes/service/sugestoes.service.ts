import {
  BadRequestException,
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
  quando,
  Sugestao,
  TipoSugestao,
} from '../sugestoes.regras';
import { ModificarSugestaoDto } from '../dto/modificar-sugestao.dto';
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

// Na redução de frequência, o que a coordenação não cancelou fica mantido e não é proposto de novo
function mantidos(original: AcaoSugestao, executada?: AcaoSugestao) {
  if (original.tipo !== 'cancelar') return [];
  const cancelados =
    executada?.tipo === 'cancelar' ? executada.atendimentoIds : [];
  return original.atendimentoIds.filter((id) => !cancelados.includes(id));
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
    const { sugestoes } = await this.calcular(agora);
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
    const { sugestao } = await this.buscarParaDecidir(id, usuario);
    const decisao = await this.registrar(
      sugestao,
      Decisao.APROVADA,
      null,
      usuario.id,
    );
    return this.executarOuDesfazer(id, sugestao.acao, decisao);
  }

  // Aprova com ajustes: a ação vai para a agenda já alterada
  async modificar(
    id: string,
    ajustes: ModificarSugestaoDto,
    usuario: UsuarioSugestoes,
  ) {
    const { sugestao, nomes } = await this.buscarParaDecidir(id, usuario);
    const { acao, ajuste } = this.ajustar(
      sugestao.acao,
      ajustes,
      usuario,
      nomes,
    );
    const decisao = await this.registrar(
      sugestao,
      Decisao.MODIFICADA,
      ajustes.motivo,
      usuario.id,
      ajuste,
      mantidos(sugestao.acao, acao),
    );
    return this.executarOuDesfazer(id, acao, decisao);
  }

  async descartar(id: string, motivo: string, usuario: UsuarioSugestoes) {
    const { sugestao } = await this.buscarParaDecidir(id, usuario);
    return this.registrar(
      sugestao,
      Decisao.DESCARTADA,
      motivo,
      usuario.id,
      null,
      mantidos(sugestao.acao),
    );
  }

  // Se a ação falhar (ex.: alguém ocupou o horário), a sugestão volta para a lista
  private async executarOuDesfazer(
    id: string,
    acao: AcaoSugestao,
    decisao: unknown,
  ) {
    try {
      const resultado = await this.executar(acao);
      return { decisao, resultado };
    } catch (erro) {
      await this.repository.removerDecisao(id);
      throw erro;
    }
  }

  private ajustar(
    acao: AcaoSugestao,
    ajustes: ModificarSugestaoDto,
    usuario: UsuarioSugestoes,
    nomes: Map<string, string>,
  ): { acao: AcaoSugestao; ajuste: string } {
    const { profissionalId, dataInicio, tipo, atendimentoIds } = ajustes;

    if (acao.tipo === 'cancelar') {
      if (profissionalId || dataInicio || tipo) {
        throw new BadRequestException(
          'Nesta sugestão só dá para escolher quais atendimentos cancelar.',
        );
      }
      const escolhidos = acao.atendimentos.filter((a) =>
        atendimentoIds?.includes(a.id),
      );
      if (
        !atendimentoIds ||
        !escolhidos.length ||
        escolhidos.length !== new Set(atendimentoIds).size
      ) {
        throw new BadRequestException(
          'Escolha ao menos um dos atendimentos da sugestão para cancelar.',
        );
      }
      if (escolhidos.length === acao.atendimentos.length) {
        throw new BadRequestException(
          'Nenhum ajuste informado. Para manter a sugestão como está, use Aprovar.',
        );
      }
      return {
        acao: {
          ...acao,
          atendimentoIds: escolhidos.map((a) => a.id),
          atendimentos: escolhidos,
        },
        ajuste: `Cancela ${escolhidos.length} de ${acao.atendimentos.length} atendimentos: ${escolhidos
          .map((a) => quando(new Date(a.dataInicio)))
          .join('; ')}.`,
      };
    }

    if (atendimentoIds) {
      throw new BadRequestException('Esta sugestão não cancela atendimentos.');
    }
    if (tipo && acao.tipo === 'transferir') {
      throw new BadRequestException(
        'Na transferência o tipo do atendimento continua o mesmo.',
      );
    }

    const mudancas: string[] = [];
    let novoProfissional = acao.profissionalId;
    let novoNome = acao.profissionalNome;
    let novaData = acao.dataInicio;

    if (profissionalId && profissionalId !== acao.profissionalId) {
      if (!usuario.coordenacao) {
        throw new ForbiddenException(
          'Só a coordenação pode trocar o profissional da sugestão.',
        );
      }
      novoProfissional = profissionalId;
      novoNome = nomes.get(profissionalId) ?? 'outro profissional';
      mudancas.push(`profissional: ${acao.profissionalNome} → ${novoNome}`);
    }
    if (
      dataInicio &&
      dataInicio.getTime() !== new Date(acao.dataInicio).getTime()
    ) {
      novaData = dataInicio.toISOString();
      mudancas.push(
        `horário: ${quando(new Date(acao.dataInicio))} → ${quando(dataInicio)}`,
      );
    }

    let ajustada: AcaoSugestao;
    if (acao.tipo === 'agendar') {
      const novoTipo = tipo ?? acao.tipoAtendimento;
      if (novoTipo !== acao.tipoAtendimento) {
        mudancas.push(`tipo: ${acao.tipoAtendimento} → ${novoTipo}`);
      }
      ajustada = {
        ...acao,
        profissionalId: novoProfissional,
        profissionalNome: novoNome,
        dataInicio: novaData,
        tipoAtendimento: novoTipo,
      };
    } else {
      ajustada = {
        ...acao,
        profissionalId: novoProfissional,
        profissionalNome: novoNome,
        dataInicio: novaData,
      };
    }

    if (!mudancas.length) {
      throw new BadRequestException(
        'Nenhum ajuste informado. Para manter a sugestão como está, use Aprovar.',
      );
    }
    const texto = mudancas.join('; ');
    return {
      acao: ajustada,
      ajuste: `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`,
    };
  }

  // As sugestões não ficam salvas: são recalculadas a partir da situação atual
  private async calcular(agora: Date) {
    const desde = inicioDaSemana(agora);
    const ate = new Date(
      Math.max(
        desde.getTime() + 14 * DIA,
        agora.getTime() + LIMITES.diasAnalisados * DIA,
      ),
    );
    const [profissionais, atendimentos, fila, decididas, mantidos] =
      await Promise.all([
        this.repository.listarProfissionais(),
        this.repository.listarAgendados(desde, ate),
        this.listaEsperaService.consultar(),
        this.repository.listarIdsDecididos(),
        this.repository.listarAtendimentosMantidos(),
      ]);
    const nomes = new Map(profissionais.map((p) => [p.id, p.nome]));
    const sugestoes = gerarSugestoes({
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
      mantidos,
    });
    return { sugestoes, nomes };
  }

  private async buscarParaDecidir(id: string, usuario: UsuarioSugestoes) {
    const { sugestoes, nomes } = await this.calcular(new Date());
    const sugestao = sugestoes.find((s) => s.id === id);
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
    return { sugestao, nomes };
  }

  private async registrar(
    sugestao: Sugestao,
    decisao: Decisao,
    motivo: string | null,
    usuarioId: string,
    ajuste: string | null = null,
    atendimentosMantidos: string[] = [],
  ) {
    const registrada = await this.repository.registrarDecisao({
      sugestaoId: sugestao.id,
      tipo: sugestao.tipo,
      titulo: sugestao.titulo,
      decisao,
      motivo,
      ajuste,
      profissionais: sugestao.profissionais,
      atendimentosMantidos,
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
          dataInicio: new Date(acao.dataInicio),
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

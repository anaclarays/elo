import { createHash } from 'node:crypto';
import { TipoAtendimento } from '../atendimentos/dto/create-atendimento.dto';
import { AreaAtuacao } from '../profissionais/dto/create-profissional.dto';

export enum TipoSugestao {
  SOBRECARGA = 'sobrecarga',
  VAGA_FILA = 'vaga_fila',
  REDUCAO_FREQUENCIA = 'reducao_frequencia',
}

// Limites usados pelas regras; ajuste aqui se a coordenação definir outros valores
export const LIMITES = {
  atendimentosPorPaciente: 4,
  diasAnalisados: 30,
  sugestoesDeVaga: 10,
  antecedenciaMinutos: 60,
} as const;

export const DURACAO_ATENDIMENTO_MIN = 20;
const MINUTO = 60_000;
const DIA = 24 * 60 * MINUTO;
// Recife fica em UTC-3 o ano todo (sem horário de verão)
const FUSO = 3 * 60 * MINUTO;

export interface ProfissionalAgenda {
  id: string;
  nome: string;
  area: string;
  capacidadeSemanal: number | null;
  horarioInicio: string | null;
  horarioFim: string | null;
}

export interface AtendimentoAgenda {
  id: string;
  profissionalId: string;
  pacienteId: string;
  isTea: boolean;
  pacienteNome: string;
  dataInicio: Date;
  tipo: TipoAtendimento;
}

export interface FamiliaFila {
  id: string;
  posicao: number;
  tipoPaciente: 'beneficiario' | 'tea';
  pacienteId: string;
  nome: string;
  dataEntrada: Date;
}

export type AcaoSugestao =
  | { tipo: 'transferir'; atendimentoId: string; profissionalId: string }
  | {
      tipo: 'agendar';
      pacienteId: string;
      isTea: boolean;
      profissionalId: string;
      dataInicio: string;
      tipoAtendimento: TipoAtendimento;
    }
  | { tipo: 'cancelar'; atendimentoIds: string[] };

export interface Sugestao {
  id: string;
  tipo: TipoSugestao;
  titulo: string;
  motivo: string;
  consequencia: string;
  // Profissionais cuja agenda muda se a sugestão for aprovada
  profissionais: string[];
  acao: AcaoSugestao;
}

export interface DadosSugestoes {
  agora: Date;
  profissionais: ProfissionalAgenda[];
  atendimentos: AtendimentoAgenda[];
  fila: FamiliaFila[];
  decididas: Set<string>;
}

const dataCurta = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Recife',
  day: '2-digit',
  month: '2-digit',
});
const hora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Recife',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const diaDaSemana = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Recife',
  weekday: 'long',
});

const quando = (data: Date) =>
  `${diaDaSemana.format(data)}, ${dataCurta.format(data)} às ${hora.format(data)}`;
const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

// Id curto e estável: a mesma situação gera sempre o mesmo id
export function idSugestao(chave: string): string {
  return createHash('sha256').update(chave).digest('hex').slice(0, 24);
}

export function inicioDaSemana(agora: Date): Date {
  const local = new Date(agora.getTime() - FUSO);
  const diasDesdeSegunda = (local.getUTCDay() + 6) % 7;
  const meiaNoite = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - diasDesdeSegunda,
  );
  return new Date(meiaNoite + FUSO);
}

function minutosDoDia(data: Date): number {
  const local = new Date(data.getTime() - FUSO);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

function emMinutos(horario: string): number {
  const [h, m] = horario.split(':').map(Number);
  return h * 60 + m;
}

function cabeNoHorario(profissional: ProfissionalAgenda, inicio: Date) {
  if (!profissional.horarioInicio || !profissional.horarioFim) return false;
  const minutos = minutosDoDia(inicio);
  return (
    minutos >= emMinutos(profissional.horarioInicio) &&
    minutos + DURACAO_ATENDIMENTO_MIN <= emMinutos(profissional.horarioFim)
  );
}

const conflita = (a: Date, b: Date) =>
  Math.abs(a.getTime() - b.getTime()) < DURACAO_ATENDIMENTO_MIN * MINUTO;

// Horários já usados na agenda e os que as próprias sugestões reservaram
class Ocupacao {
  private readonly reservas: {
    profissionalId: string;
    paciente: string;
    inicio: Date;
  }[] = [];

  constructor(private readonly atendimentos: AtendimentoAgenda[]) {}

  reservar(profissionalId: string, paciente: string, inicio: Date) {
    this.reservas.push({ profissionalId, paciente, inicio });
  }

  profissionalLivre(profissionalId: string, inicio: Date, ignorar?: string) {
    return (
      !this.atendimentos.some(
        (a) =>
          a.id !== ignorar &&
          a.profissionalId === profissionalId &&
          conflita(a.dataInicio, inicio),
      ) &&
      !this.reservas.some(
        (r) =>
          r.profissionalId === profissionalId && conflita(r.inicio, inicio),
      )
    );
  }

  pacienteLivre(paciente: string, inicio: Date) {
    return (
      !this.atendimentos.some(
        (a) => chavePaciente(a) === paciente && conflita(a.dataInicio, inicio),
      ) &&
      !this.reservas.some(
        (r) => r.paciente === paciente && conflita(r.inicio, inicio),
      )
    );
  }
}

const chavePaciente = (p: { isTea: boolean; pacienteId: string }) =>
  `${p.isTea ? 'tea' : 'beneficiario'}:${p.pacienteId}`;

interface Semana {
  inicio: Date;
  fim: Date;
  contagem: Map<string, number>;
}

function montarSemanas(dados: DadosSugestoes): Semana[] {
  const primeira = inicioDaSemana(dados.agora);
  return [0, 1].map((indice) => {
    const inicio = new Date(primeira.getTime() + indice * 7 * DIA);
    const fim = new Date(inicio.getTime() + 7 * DIA);
    const contagem = new Map<string, number>();
    for (const a of dados.atendimentos) {
      if (a.dataInicio >= inicio && a.dataInicio < fim) {
        contagem.set(
          a.profissionalId,
          (contagem.get(a.profissionalId) ?? 0) + 1,
        );
      }
    }
    return { inicio, fim, contagem };
  });
}

const ocupados = (semana: Semana, id: string) => semana.contagem.get(id) ?? 0;

// Tipo mais frequente do profissional; sem histórico, usa o padrão da área
function tipoPadrao(
  profissional: ProfissionalAgenda,
  atendimentos: AtendimentoAgenda[],
) {
  const vezes = new Map<TipoAtendimento, number>();
  for (const a of atendimentos) {
    if (a.profissionalId === profissional.id)
      vezes.set(a.tipo, (vezes.get(a.tipo) ?? 0) + 1);
  }
  const maisFrequente = [...vezes].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (maisFrequente) return maisFrequente;
  if (profissional.area === AreaAtuacao.VOLUNTARIADO_SAUDE)
    return TipoAtendimento.PSICOLOGIA;
  if (profissional.area === AreaAtuacao.VOLUNTARIADO_EDUCACAO)
    return TipoAtendimento.PEDAGOGIA;
  return null;
}

function sobrecarga(
  dados: DadosSugestoes,
  semanas: Semana[],
  ocupacao: Ocupacao,
): Sugestao[] {
  const sugestoes: Sugestao[] = [];
  const limiteInicio =
    dados.agora.getTime() + LIMITES.antecedenciaMinutos * MINUTO;
  const tipos = new Set(
    dados.atendimentos.map((a) => `${a.profissionalId}:${a.tipo}`),
  );
  const atende = (profissionalId: string, tipo: TipoAtendimento) =>
    tipos.has(`${profissionalId}:${tipo}`);

  for (const semana of semanas) {
    for (const origem of dados.profissionais) {
      const capacidade = origem.capacidadeSemanal;
      if (capacidade === null || ocupados(semana, origem.id) <= capacidade)
        continue;

      // Os últimos atendimentos da semana são os mais fáceis de remanejar
      const candidatos = dados.atendimentos
        .filter(
          (a) =>
            a.profissionalId === origem.id &&
            a.dataInicio >= semana.inicio &&
            a.dataInicio < semana.fim &&
            a.dataInicio.getTime() >= limiteInicio,
        )
        .sort((a, b) => b.dataInicio.getTime() - a.dataInicio.getTime());

      for (const atendimento of candidatos) {
        const antes = ocupados(semana, origem.id);
        if (antes <= capacidade) break;

        const destino = dados.profissionais
          .filter(
            (d) =>
              d.id !== origem.id &&
              d.area === origem.area &&
              d.capacidadeSemanal !== null &&
              ocupados(semana, d.id) < d.capacidadeSemanal &&
              cabeNoHorario(d, atendimento.dataInicio) &&
              ocupacao.profissionalLivre(
                d.id,
                atendimento.dataInicio,
                atendimento.id,
              ) &&
              !dados.decididas.has(
                idSugestao(
                  `${TipoSugestao.SOBRECARGA}:${atendimento.id}:${d.id}`,
                ),
              ),
          )
          // Prefere quem já atende o mesmo tipo; depois, quem está menos ocupado
          .sort(
            (a, b) =>
              Number(atende(b.id, atendimento.tipo)) -
                Number(atende(a.id, atendimento.tipo)) ||
              ocupados(semana, a.id) / a.capacidadeSemanal! -
                ocupados(semana, b.id) / b.capacidadeSemanal! ||
              a.nome.localeCompare(b.nome, 'pt-BR'),
          )[0];
        if (!destino) continue;
        const aviso = atende(destino.id, atendimento.tipo)
          ? ''
          : ` O atendimento continua sendo de ${atendimento.tipo}: confirme se ${destino.nome} atende esse tipo antes de aprovar.`;

        const destinoAntes = ocupados(semana, destino.id);
        semana.contagem.set(origem.id, antes - 1);
        semana.contagem.set(destino.id, destinoAntes + 1);
        ocupacao.reservar(
          destino.id,
          chavePaciente(atendimento),
          atendimento.dataInicio,
        );

        sugestoes.push({
          id: idSugestao(
            `${TipoSugestao.SOBRECARGA}:${atendimento.id}:${destino.id}`,
          ),
          tipo: TipoSugestao.SOBRECARGA,
          titulo: `Transferir o atendimento de ${atendimento.pacienteNome} para ${destino.nome}`,
          motivo: `${origem.nome} tem ${antes} atendimentos na semana de ${dataCurta.format(semana.inicio)}, acima da capacidade semanal de ${capacidade}.`,
          consequencia: `O atendimento de ${quando(atendimento.dataInicio)} passa para ${destino.nome}, no mesmo horário. ${origem.nome} fica com ${antes - 1} de ${capacidade} e ${destino.nome} passa a ${destinoAntes + 1} de ${destino.capacidadeSemanal} na semana.${aviso}`,
          profissionais: [origem.id, destino.id],
          acao: {
            tipo: 'transferir',
            atendimentoId: atendimento.id,
            profissionalId: destino.id,
          },
        });
      }
    }
  }
  return sugestoes;
}

function primeiroHorarioLivre(
  profissional: ProfissionalAgenda,
  semana: Semana,
  paciente: string,
  ocupacao: Ocupacao,
  agora: Date,
): Date | null {
  if (!profissional.horarioInicio || !profissional.horarioFim) return null;
  const limiteInicio = agora.getTime() + LIMITES.antecedenciaMinutos * MINUTO;
  const inicioExpediente = emMinutos(profissional.horarioInicio);
  const fimExpediente = emMinutos(profissional.horarioFim);

  // Segunda a sábado, em passos de 20 minutos a partir do início do expediente
  for (let dia = 0; dia < 6; dia++) {
    for (
      let minuto = inicioExpediente;
      minuto + DURACAO_ATENDIMENTO_MIN <= fimExpediente;
      minuto += DURACAO_ATENDIMENTO_MIN
    ) {
      const inicio = new Date(
        semana.inicio.getTime() + dia * DIA + minuto * MINUTO,
      );
      if (inicio.getTime() < limiteInicio) continue;
      if (
        ocupacao.profissionalLivre(profissional.id, inicio) &&
        ocupacao.pacienteLivre(paciente, inicio)
      )
        return inicio;
    }
  }
  return null;
}

function vagasParaFila(
  dados: DadosSugestoes,
  semanas: Semana[],
  ocupacao: Ocupacao,
): Sugestao[] {
  const sugestoes: Sugestao[] = [];
  const aptos = dados.profissionais
    .map((profissional) => ({
      profissional,
      tipo: tipoPadrao(profissional, dados.atendimentos),
    }))
    .filter(
      ({ profissional, tipo }) =>
        tipo &&
        profissional.capacidadeSemanal !== null &&
        profissional.horarioInicio &&
        profissional.horarioFim,
    );

  for (const familia of dados.fila) {
    if (sugestoes.length >= LIMITES.sugestoesDeVaga) break;
    const paciente = `${familia.tipoPaciente}:${familia.pacienteId}`;
    const diasNaFila = Math.max(
      0,
      Math.floor((dados.agora.getTime() - familia.dataEntrada.getTime()) / DIA),
    );

    encontrar: for (const semana of semanas) {
      const porFolga = aptos
        .filter(
          ({ profissional }) =>
            ocupados(semana, profissional.id) < profissional.capacidadeSemanal!,
        )
        .sort(
          (a, b) =>
            b.profissional.capacidadeSemanal! -
              ocupados(semana, b.profissional.id) -
              (a.profissional.capacidadeSemanal! -
                ocupados(semana, a.profissional.id)) ||
            a.profissional.nome.localeCompare(b.profissional.nome, 'pt-BR'),
        );

      for (const { profissional, tipo } of porFolga) {
        const id = idSugestao(
          `${TipoSugestao.VAGA_FILA}:${familia.id}:${profissional.id}`,
        );
        if (dados.decididas.has(id)) continue;
        const inicio = primeiroHorarioLivre(
          profissional,
          semana,
          paciente,
          ocupacao,
          dados.agora,
        );
        if (!inicio) continue;

        const capacidade = profissional.capacidadeSemanal!;
        const antes = ocupados(semana, profissional.id);
        semana.contagem.set(profissional.id, antes + 1);
        ocupacao.reservar(profissional.id, paciente, inicio);

        sugestoes.push({
          id,
          tipo: TipoSugestao.VAGA_FILA,
          titulo: `Agendar ${familia.nome} com ${profissional.nome}`,
          motivo: `${profissional.nome} tem ${plural(capacidade - antes, 'vaga livre', 'vagas livres')} na semana de ${dataCurta.format(semana.inicio)} (${antes} de ${capacidade} ocupadas), e ${familia.nome} está na ${familia.posicao}ª posição da lista de espera, há ${plural(diasNaFila, 'dia', 'dias')}.`,
          consequencia: `${familia.nome} sai da lista de espera com o primeiro atendimento (${tipo}) em ${quando(inicio)}. ${profissional.nome} passa a ${antes + 1} de ${capacidade} atendimentos na semana.`,
          profissionais: [profissional.id],
          acao: {
            tipo: 'agendar',
            pacienteId: familia.pacienteId,
            isTea: familia.tipoPaciente === 'tea',
            profissionalId: profissional.id,
            dataInicio: inicio.toISOString(),
            tipoAtendimento: tipo!,
          },
        });
        break encontrar;
      }
    }
  }
  return sugestoes;
}

function reducaoDeFrequencia(dados: DadosSugestoes): Sugestao[] {
  if (!dados.fila.length) return [];
  const desde = dados.agora.getTime() + LIMITES.antecedenciaMinutos * MINUTO;
  const ate = dados.agora.getTime() + LIMITES.diasAnalisados * DIA;
  const porPaciente = new Map<string, AtendimentoAgenda[]>();
  for (const a of dados.atendimentos) {
    if (a.dataInicio.getTime() < desde || a.dataInicio.getTime() >= ate)
      continue;
    porPaciente.set(chavePaciente(a), [
      ...(porPaciente.get(chavePaciente(a)) ?? []),
      a,
    ]);
  }

  const sugestoes: Sugestao[] = [];
  for (const [paciente, atendimentos] of porPaciente) {
    if (atendimentos.length <= LIMITES.atendimentosPorPaciente) continue;
    // Mantém os mais próximos e propõe cancelar os mais distantes
    const excedentes = [...atendimentos]
      .sort((a, b) => a.dataInicio.getTime() - b.dataInicio.getTime())
      .slice(LIMITES.atendimentosPorPaciente);
    const ids = excedentes.map((a) => a.id).sort();
    const id = idSugestao(
      `${TipoSugestao.REDUCAO_FREQUENCIA}:${paciente}:${ids.join(',')}`,
    );
    if (dados.decididas.has(id)) continue;

    const nome = atendimentos[0].pacienteNome;
    sugestoes.push({
      id,
      tipo: TipoSugestao.REDUCAO_FREQUENCIA,
      titulo: `Reduzir a frequência de ${nome}`,
      motivo: `${nome} tem ${atendimentos.length} atendimentos nos próximos ${LIMITES.diasAnalisados} dias, acima do limite de ${LIMITES.atendimentosPorPaciente} (cerca de 1 por semana), enquanto ${plural(dados.fila.length, 'família espera', 'famílias esperam')} na lista de espera.`,
      consequencia: `Cancela ${plural(excedentes.length, 'atendimento', 'atendimentos')} (${excedentes.map((a) => quando(a.dataInicio)).join('; ')}) e libera ${plural(excedentes.length, 'horário', 'horários')} no mês para famílias da fila. Confirme com o profissional responsável antes de aprovar.`,
      profissionais: [...new Set(excedentes.map((a) => a.profissionalId))],
      acao: { tipo: 'cancelar', atendimentoIds: excedentes.map((a) => a.id) },
    });
  }
  return sugestoes;
}

// Regras explicáveis sobre a agenda e a lista de espera: nada muda sem aprovação da coordenação
export function gerarSugestoes(dados: DadosSugestoes): Sugestao[] {
  const semanas = montarSemanas(dados);
  const ocupacao = new Ocupacao(dados.atendimentos);
  return [
    ...sobrecarga(dados, semanas, ocupacao),
    ...vagasParaFila(dados, semanas, ocupacao),
    ...reducaoDeFrequencia(dados),
  ];
}

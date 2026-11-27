import { TipoAtendimento } from '../../atendimentos/dto/create-atendimento.dto';
import { AreaAtuacao } from '../../profissionais/dto/create-profissional.dto';
import {
  AtendimentoAgenda,
  DadosSugestoes,
  FamiliaFila,
  gerarSugestoes,
  idSugestao,
  inicioDaSemana,
  LIMITES,
  ProfissionalAgenda,
  TipoSugestao,
} from '../sugestoes.regras';

// Quarta-feira, 25/11/2026, 09:00 em Recife
const agora = new Date('2026-11-25T09:00:00-03:00');
const em = (dia: string, hora: string) => new Date(`${dia}T${hora}:00-03:00`);

const profissional = (
  dados: Partial<ProfissionalAgenda> & { id: string },
): ProfissionalAgenda => ({
  nome: dados.id,
  area: AreaAtuacao.VOLUNTARIADO_SAUDE,
  capacidadeSemanal: 10,
  horarioInicio: '08:00',
  horarioFim: '12:00',
  ...dados,
});

let sequencia = 0;
const atendimento = (
  dados: Partial<AtendimentoAgenda> & {
    profissionalId: string;
    dataInicio: Date;
  },
): AtendimentoAgenda => ({
  id: `at-${++sequencia}`,
  pacienteId: String(sequencia),
  isTea: false,
  pacienteNome: `Paciente ${sequencia}`,
  tipo: TipoAtendimento.PSICOLOGIA,
  ...dados,
});

const familia = (posicao: number, pacienteId = `9${posicao}`): FamiliaFila => ({
  id: `fila-${posicao}`,
  posicao,
  tipoPaciente: 'beneficiario',
  pacienteId,
  nome: `Família ${posicao}`,
  dataEntrada: new Date('2026-11-01T10:00:00-03:00'),
});

const dados = (parcial: Partial<DadosSugestoes>): DadosSugestoes => ({
  agora,
  profissionais: [],
  atendimentos: [],
  fila: [],
  decididas: new Set(),
  ...parcial,
});

const doTipo = (dadosSugestoes: DadosSugestoes, tipo: TipoSugestao) =>
  gerarSugestoes(dadosSugestoes).filter((s) => s.tipo === tipo);

describe('inicioDaSemana', () => {
  it.each([
    ['quarta', '2026-11-25T09:00:00-03:00'],
    ['segunda à meia-noite e meia', '2026-11-23T00:30:00-03:00'],
    ['domingo à noite', '2026-11-29T23:00:00-03:00'],
  ])('volta para a segunda-feira 00:00 de Recife (%s)', (_, data) => {
    expect(inicioDaSemana(new Date(data)).toISOString()).toBe(
      '2026-11-23T03:00:00.000Z',
    );
  });
});

describe('idSugestao', () => {
  it('gera sempre o mesmo id curto para a mesma chave', () => {
    expect(idSugestao('vaga_fila:a:b')).toBe(idSugestao('vaga_fila:a:b'));
    expect(idSugestao('vaga_fila:a:b')).toMatch(/^[0-9a-f]{24}$/);
    expect(idSugestao('vaga_fila:a:b')).not.toBe(idSugestao('vaga_fila:a:c'));
  });
});

describe('gerarSugestoes', () => {
  it('não sugere nada sem agenda e sem fila', () => {
    expect(gerarSugestoes(dados({}))).toEqual([]);
  });

  describe('sobrecarga', () => {
    const ana = profissional({ id: 'ana', nome: 'Ana', capacidadeSemanal: 2 });
    const agendaDaAna = [
      atendimento({
        profissionalId: 'ana',
        dataInicio: em('2026-11-26', '08:00'),
      }),
      atendimento({
        profissionalId: 'ana',
        dataInicio: em('2026-11-26', '09:00'),
      }),
      atendimento({
        profissionalId: 'ana',
        dataInicio: em('2026-11-26', '10:00'),
      }),
    ];

    it('propõe transferir o último atendimento excedente para quem tem folga na mesma área', () => {
      const bruno = profissional({
        id: 'bruno',
        nome: 'Bruno',
        capacidadeSemanal: 3,
      });
      const carla = profissional({
        id: 'carla',
        nome: 'Carla',
        area: AreaAtuacao.VOLUNTARIADO_EDUCACAO,
      });

      const sugestoes = gerarSugestoes(
        dados({
          profissionais: [ana, bruno, carla],
          atendimentos: agendaDaAna,
        }),
      );

      expect(sugestoes).toHaveLength(1);
      expect(sugestoes[0]).toMatchObject({
        id: idSugestao(`sobrecarga:${agendaDaAna[2].id}:bruno`),
        tipo: TipoSugestao.SOBRECARGA,
        profissionais: ['ana', 'bruno'],
        acao: {
          tipo: 'transferir',
          atendimentoId: agendaDaAna[2].id,
          profissionalId: 'bruno',
        },
      });
      expect(sugestoes[0].motivo).toContain(
        'Ana tem 3 atendimentos na semana de 23/11, acima da capacidade semanal de 2',
      );
      expect(sugestoes[0].consequencia).toContain(
        'Ana fica com 2 de 2 e Bruno passa a 1 de 3',
      );
    });

    it('escolhe o destino menos ocupado e ignora quem tem conflito ou não atende no horário', () => {
      const bruno = profissional({ id: 'bruno', capacidadeSemanal: 2 });
      const davi = profissional({ id: 'davi', capacidadeSemanal: 10 });
      const eva = profissional({
        id: 'eva',
        horarioInicio: '13:00',
        horarioFim: '17:00',
      });
      const fabi = profissional({ id: 'fabi', capacidadeSemanal: 10 });
      const atendimentos = [
        ...agendaDaAna,
        atendimento({
          profissionalId: 'bruno',
          dataInicio: em('2026-11-27', '08:00'),
        }),
        atendimento({
          profissionalId: 'davi',
          dataInicio: em('2026-11-27', '08:00'),
        }),
        // Fabi está livre na semana, mas ocupada no horário do atendimento
        atendimento({
          profissionalId: 'fabi',
          dataInicio: em('2026-11-26', '10:10'),
        }),
      ];

      const [sugestao] = doTipo(
        dados({ profissionais: [ana, bruno, davi, eva, fabi], atendimentos }),
        TipoSugestao.SOBRECARGA,
      );

      expect(sugestao.acao).toMatchObject({ profissionalId: 'davi' });
    });

    it('prefere quem já atende o mesmo tipo e avisa quando ninguém atende', () => {
      const bruno = profissional({ id: 'bruno', nome: 'Bruno' });
      const davi = profissional({ id: 'davi', nome: 'Davi' });
      const agendaDeTerapia = agendaDaAna.map((a) => ({
        ...a,
        tipo: TipoAtendimento.TERAPIA_OCUPACIONAL,
      }));
      const terapiaDoDavi = atendimento({
        profissionalId: 'davi',
        dataInicio: em('2026-11-27', '11:00'),
        tipo: TipoAtendimento.TERAPIA_OCUPACIONAL,
      });

      const [comTerapeuta] = doTipo(
        dados({
          profissionais: [ana, bruno, davi],
          atendimentos: [...agendaDeTerapia, terapiaDoDavi],
        }),
        TipoSugestao.SOBRECARGA,
      );
      const [semTerapeuta] = doTipo(
        dados({ profissionais: [ana, bruno], atendimentos: agendaDeTerapia }),
        TipoSugestao.SOBRECARGA,
      );

      expect(comTerapeuta.acao).toMatchObject({ profissionalId: 'davi' });
      expect(comTerapeuta.consequencia).not.toContain('confirme');
      expect(semTerapeuta.consequencia).toContain(
        'confirme se Bruno atende esse tipo antes de aprovar',
      );
    });

    it('não repete uma transferência já decidida e tenta outro destino', () => {
      const bruno = profissional({ id: 'bruno' });
      const davi = profissional({ id: 'davi' });
      const decididas = new Set([
        idSugestao(`sobrecarga:${agendaDaAna[2].id}:bruno`),
      ]);

      const [sugestao] = doTipo(
        dados({
          profissionais: [ana, bruno, davi],
          atendimentos: agendaDaAna,
          decididas,
        }),
        TipoSugestao.SOBRECARGA,
      );

      expect(sugestao.acao).toMatchObject({ profissionalId: 'davi' });
    });

    it('não mexe em atendimentos que começam em menos de uma hora', () => {
      const bruno = profissional({ id: 'bruno' });
      const atendimentos = [
        atendimento({
          profissionalId: 'ana',
          dataInicio: em('2026-11-24', '08:00'),
        }),
        atendimento({
          profissionalId: 'ana',
          dataInicio: em('2026-11-24', '09:00'),
        }),
        atendimento({
          profissionalId: 'ana',
          dataInicio: em('2026-11-25', '09:30'),
        }),
      ];

      expect(
        doTipo(
          dados({ profissionais: [ana, bruno], atendimentos }),
          TipoSugestao.SOBRECARGA,
        ),
      ).toEqual([]);
    });
  });

  describe('vaga_fila', () => {
    it('agenda as famílias pela ordem da fila no primeiro horário livre', () => {
      const bruno = profissional({
        id: 'bruno',
        nome: 'Bruno',
        capacidadeSemanal: 1,
      });

      const sugestoes = doTipo(
        dados({ profissionais: [bruno], fila: [familia(1), familia(2)] }),
        TipoSugestao.VAGA_FILA,
      );

      expect(sugestoes.map((s) => s.acao)).toEqual([
        {
          tipo: 'agendar',
          pacienteId: '91',
          isTea: false,
          profissionalId: 'bruno',
          profissionalNome: 'Bruno',
          // Hoje às 10:00: uma hora depois de agora
          dataInicio: em('2026-11-25', '10:00').toISOString(),
          tipoAtendimento: TipoAtendimento.PSICOLOGIA,
        },
        {
          tipo: 'agendar',
          pacienteId: '92',
          isTea: false,
          profissionalId: 'bruno',
          profissionalNome: 'Bruno',
          // A capacidade desta semana acabou: vai para a segunda seguinte
          dataInicio: em('2026-11-30', '08:00').toISOString(),
          tipoAtendimento: TipoAtendimento.PSICOLOGIA,
        },
      ]);
      expect(sugestoes[0].motivo).toContain(
        '1ª posição da lista de espera, há 23 dias',
      );
    });

    it('pula horários ocupados e usa o tipo mais frequente do profissional', () => {
      const carla = profissional({
        id: 'carla',
        area: AreaAtuacao.VOLUNTARIADO_EDUCACAO,
      });
      const atendimentos = [
        atendimento({
          profissionalId: 'carla',
          dataInicio: em('2026-11-25', '10:00'),
          tipo: TipoAtendimento.TERAPIA_OCUPACIONAL,
        }),
      ];

      const [sugestao] = doTipo(
        dados({ profissionais: [carla], atendimentos, fila: [familia(1)] }),
        TipoSugestao.VAGA_FILA,
      );

      expect(sugestao.acao).toMatchObject({
        dataInicio: em('2026-11-25', '10:20').toISOString(),
        tipoAtendimento: TipoAtendimento.TERAPIA_OCUPACIONAL,
      });
    });

    it('ignora profissionais sem capacidade, sem horário ou sem tipo de atendimento definido', () => {
      const profissionais = [
        profissional({ id: 'lotado', capacidadeSemanal: 0 }),
        profissional({ id: 'sem-horario', horarioInicio: null }),
        profissional({ id: 'sem-capacidade', capacidadeSemanal: null }),
        profissional({
          id: 'coord',
          area: AreaAtuacao.COORDENACAO_ADMINISTRATIVA,
        }),
      ];

      expect(
        doTipo(
          dados({ profissionais, fila: [familia(1)] }),
          TipoSugestao.VAGA_FILA,
        ),
      ).toEqual([]);
    });

    it('limita a quantidade de sugestões de vaga', () => {
      const bruno = profissional({ id: 'bruno', capacidadeSemanal: 50 });
      const fila = Array.from({ length: 15 }, (_, i) => familia(i + 1));

      expect(
        doTipo(dados({ profissionais: [bruno], fila }), TipoSugestao.VAGA_FILA),
      ).toHaveLength(LIMITES.sugestoesDeVaga);
    });

    it('não repete a dupla família e profissional já descartada', () => {
      const bruno = profissional({ id: 'bruno' });
      const decididas = new Set([idSugestao('vaga_fila:fila-1:bruno')]);

      expect(
        doTipo(
          dados({ profissionais: [bruno], fila: [familia(1)], decididas }),
          TipoSugestao.VAGA_FILA,
        ),
      ).toEqual([]);
    });
  });

  describe('reducao_frequencia', () => {
    const bruno = profissional({ id: 'bruno', capacidadeSemanal: 20 });
    const dias = [
      '2026-11-26',
      '2026-12-01',
      '2026-12-03',
      '2026-12-08',
      '2026-12-10',
      '2026-12-15',
    ];
    const agendaDoPaciente = dias.map((dia) =>
      atendimento({
        profissionalId: 'bruno',
        dataInicio: em(dia, '08:00'),
        pacienteId: '7',
        pacienteNome: 'João',
      }),
    );

    it('propõe cancelar os atendimentos mais distantes de quem passou do limite quando há fila', () => {
      const [sugestao] = doTipo(
        dados({
          profissionais: [bruno],
          atendimentos: agendaDoPaciente,
          fila: [familia(1)],
        }),
        TipoSugestao.REDUCAO_FREQUENCIA,
      );

      expect(sugestao.acao).toEqual({
        tipo: 'cancelar',
        atendimentoIds: [agendaDoPaciente[4].id, agendaDoPaciente[5].id],
        atendimentos: [agendaDoPaciente[4], agendaDoPaciente[5]].map((a) => ({
          id: a.id,
          dataInicio: a.dataInicio.toISOString(),
        })),
      });
      expect(sugestao.motivo).toContain(
        'João tem 6 atendimentos nos próximos 30 dias',
      );
      expect(sugestao.consequencia).toContain('libera 2 horários');
    });

    it('não conta para o limite os atendimentos que a coordenação já decidiu manter', () => {
      const comUmMantido = dados({
        profissionais: [bruno],
        atendimentos: agendaDoPaciente,
        fila: [familia(1)],
      });
      comUmMantido.mantidos = new Set([agendaDoPaciente[5].id]);
      const [sugestao] = doTipo(comUmMantido, TipoSugestao.REDUCAO_FREQUENCIA);

      expect(sugestao.acao).toEqual(
        expect.objectContaining({ atendimentoIds: [agendaDoPaciente[4].id] }),
      );

      comUmMantido.mantidos = new Set([
        agendaDoPaciente[4].id,
        agendaDoPaciente[5].id,
      ]);
      expect(doTipo(comUmMantido, TipoSugestao.REDUCAO_FREQUENCIA)).toEqual([]);
    });

    it('não sugere redução quando a fila está vazia', () => {
      expect(
        doTipo(
          dados({ profissionais: [bruno], atendimentos: agendaDoPaciente }),
          TipoSugestao.REDUCAO_FREQUENCIA,
        ),
      ).toEqual([]);
    });

    it('não sugere redução para quem está dentro do limite', () => {
      expect(
        doTipo(
          dados({
            profissionais: [bruno],
            atendimentos: agendaDoPaciente.slice(
              0,
              LIMITES.atendimentosPorPaciente,
            ),
            fila: [familia(1)],
          }),
          TipoSugestao.REDUCAO_FREQUENCIA,
        ),
      ).toEqual([]);
    });
  });
});

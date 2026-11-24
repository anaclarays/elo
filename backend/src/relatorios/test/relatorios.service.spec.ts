import { BadRequestException } from '@nestjs/common';
import { RelatoriosRepository } from '../relatorios.repository';
import { RelatoriosService } from '../service/relatorios.service';

describe('RelatoriosService', () => {
  let service: RelatoriosService;
  const executor = { query: jest.fn() };

  const repository = {
    emLeitura: jest.fn(),
    pacientesAtivos: jest.fn(),
    pacientesCadastrados: jest.fn(),
    filaAtual: jest.fn(),
    movimentoFila: jest.fn(),
    atendimentos: jest.fn(),
    atendimentosPorTipo: jest.fn(),
    atendimentosPorProfissional: jest.fn(),
    profissionaisPorArea: jest.fn(),
  };

  const novembro = { dataInicio: '2026-11-01', dataFim: '2026-11-30' };

  const pacientesAtivos = {
    total: 5,
    beneficiario: 3,
    tea: 2,
    crianca: 1,
    adolescente: 2,
    adulto: 1,
    idoso: 1,
    nivel1: 0,
    nivel2: 1,
    nivel3: 1,
  };
  const filaAtual = {
    total: 2,
    beneficiario: 1,
    tea: 1,
    esperaMediaDias: 7,
    maiorEsperaDias: 10,
  };
  const porTipo = [
    { tipo: 'psicologia', total: 2 },
    { tipo: 'terapia ocupacional', total: 0 },
    { tipo: 'pedagogia', total: 2 },
  ];
  const porProfissional = [{ profissionalId: 'p1', nome: 'Ana', total: 2 }];

  beforeEach(() => {
    jest.resetAllMocks();
    repository.emLeitura.mockImplementation((consulta) => consulta(executor));
    repository.pacientesAtivos.mockResolvedValue(pacientesAtivos);
    repository.pacientesCadastrados.mockResolvedValue({
      beneficiario: 2,
      tea: 1,
    });
    repository.filaAtual.mockResolvedValue(filaAtual);
    repository.movimentoFila.mockResolvedValue({
      entradas: 4,
      saidasPorAgendamento: 2,
      saidasManuais: 1,
      esperaMediaAteAgendamentoDias: 22.5,
    });
    repository.atendimentos.mockResolvedValue({
      total: 5,
      agendados: 4,
      cancelados: 1,
      pacientesDistintos: 3,
    });
    repository.atendimentosPorTipo.mockResolvedValue(porTipo);
    repository.atendimentosPorProfissional.mockResolvedValue(porProfissional);
    repository.profissionaisPorArea.mockResolvedValue([
      {
        area: 'coordenacao_administrativa',
        ativos: 1,
        cadastradosNoPeriodo: 1,
      },
      { area: 'voluntariado_saude', ativos: 2, cadastradosNoPeriodo: 1 },
    ]);

    service = new RelatoriosService(
      repository as unknown as RelatoriosRepository,
    );
  });

  describe('período', () => {
    it('repassa as datas informadas para as consultas', async () => {
      await service.atendimentos(novembro);

      expect(repository.atendimentos).toHaveBeenCalledWith(executor, novembro);
    });

    it('sem datas, consulta todo o histórico', async () => {
      const resultado = await service.atendimentos();

      expect(resultado.periodo).toEqual({ dataInicio: null, dataFim: null });
      expect(repository.atendimentos).toHaveBeenCalledWith(executor, {
        dataInicio: null,
        dataFim: null,
      });
    });

    it('aceita só a data inicial, deixando o fim em aberto', async () => {
      await service.atendimentos({ dataInicio: '2026-12-01' });

      expect(repository.atendimentos).toHaveBeenCalledWith(executor, {
        dataInicio: '2026-12-01',
        dataFim: null,
      });
    });

    it('aceita período de um único dia', async () => {
      await expect(
        service.atendimentos({
          dataInicio: '2026-11-10',
          dataFim: '2026-11-10',
        }),
      ).resolves.toBeDefined();
    });

    it.each([
      [
        'geral',
        () =>
          service.geral({ dataInicio: '2026-12-01', dataFim: '2026-11-01' }),
      ],
      [
        'pacientes',
        () =>
          service.pacientes({
            dataInicio: '2026-12-01',
            dataFim: '2026-11-01',
          }),
      ],
      [
        'listaEspera',
        () =>
          service.listaEspera({
            dataInicio: '2026-12-01',
            dataFim: '2026-11-01',
          }),
      ],
      [
        'atendimentos',
        () =>
          service.atendimentos({
            dataInicio: '2026-12-01',
            dataFim: '2026-11-01',
          }),
      ],
      [
        'profissionais',
        () =>
          service.profissionais({
            dataInicio: '2026-12-01',
            dataFim: '2026-11-01',
          }),
      ],
    ])(
      '%s recusa data inicial posterior à final, sem consultar o banco',
      async (_nome, consultar) => {
        await expect(consultar()).rejects.toThrow(
          new BadRequestException(
            'A data inicial não pode ser posterior à data final',
          ),
        );
        expect(repository.emLeitura).not.toHaveBeenCalled();
      },
    );
  });

  describe('pacientes', () => {
    it('organiza os indicadores de pacientes e devolve o período', async () => {
      await expect(service.pacientes(novembro)).resolves.toEqual({
        periodo: novembro,
        ativos: { total: 5, beneficiario: 3, tea: 2 },
        cadastradosNoPeriodo: { total: 3, beneficiario: 2, tea: 1 },
        ativosPorFaixaEtaria: {
          crianca: 1,
          adolescente: 2,
          adulto: 1,
          idoso: 1,
        },
        teaAtivosPorNivelSuporte: { nivel1: 0, nivel2: 1, nivel3: 1 },
      });
      expect(repository.emLeitura).toHaveBeenCalledTimes(1);
    });
  });

  describe('lista de espera', () => {
    it('soma as saídas e separa por motivo', async () => {
      await expect(service.listaEspera(novembro)).resolves.toEqual({
        periodo: novembro,
        filaAtual,
        noPeriodo: {
          entradas: 4,
          saidas: { total: 3, porAgendamento: 2, manuais: 1 },
          esperaMediaAteAgendamentoDias: 22.5,
        },
      });
    });

    it('mantém null nas médias quando não há dados para calcular', async () => {
      repository.filaAtual.mockResolvedValue({
        ...filaAtual,
        total: 0,
        esperaMediaDias: null,
        maiorEsperaDias: null,
      });
      repository.movimentoFila.mockResolvedValue({
        entradas: 0,
        saidasPorAgendamento: 0,
        saidasManuais: 0,
        esperaMediaAteAgendamentoDias: null,
      });

      const resultado = await service.listaEspera();

      expect(resultado.filaAtual.esperaMediaDias).toBeNull();
      expect(resultado.noPeriodo.esperaMediaAteAgendamentoDias).toBeNull();
    });
  });

  describe('atendimentos', () => {
    it('calcula a taxa de cancelamento com uma casa decimal', async () => {
      await expect(service.atendimentos(novembro)).resolves.toEqual({
        periodo: novembro,
        total: 5,
        agendados: 4,
        cancelados: 1,
        taxaCancelamentoPercentual: 20,
        pacientesDistintos: 3,
        porTipo,
        porProfissional,
      });
    });

    it('arredonda a taxa de cancelamento', async () => {
      repository.atendimentos.mockResolvedValue({
        total: 6,
        agendados: 5,
        cancelados: 1,
        pacientesDistintos: 3,
      });

      const resultado = await service.atendimentos();

      expect(resultado.taxaCancelamentoPercentual).toBe(16.7);
    });

    it('devolve taxa null quando não há atendimentos no período', async () => {
      repository.atendimentos.mockResolvedValue({
        total: 0,
        agendados: 0,
        cancelados: 0,
        pacientesDistintos: 0,
      });

      const resultado = await service.atendimentos(novembro);

      expect(resultado.taxaCancelamentoPercentual).toBeNull();
    });
  });

  describe('profissionais', () => {
    it('mostra todas as áreas de atuação, com zero nas que não têm profissionais', async () => {
      await expect(service.profissionais(novembro)).resolves.toEqual({
        periodo: novembro,
        ativos: 3,
        cadastradosNoPeriodo: 2,
        porArea: [
          {
            area: 'coordenacao_administrativa',
            ativos: 1,
            cadastradosNoPeriodo: 1,
          },
          { area: 'voluntariado_saude', ativos: 2, cadastradosNoPeriodo: 1 },
          {
            area: 'voluntariado_educacao',
            ativos: 0,
            cadastradosNoPeriodo: 0,
          },
        ],
      });
    });

    it('devolve zero quando não há profissionais ativos', async () => {
      repository.profissionaisPorArea.mockResolvedValue([]);

      const resultado = await service.profissionais();

      expect(resultado.ativos).toBe(0);
      expect(resultado.porArea.every((area) => area.ativos === 0)).toBe(true);
    });
  });

  describe('geral', () => {
    it('reúne todas as seções numa única transação de leitura', async () => {
      const resultado = await service.geral(novembro);

      expect(repository.emLeitura).toHaveBeenCalledTimes(1);
      expect(resultado.periodo).toEqual(novembro);
      expect(resultado.pacientes.ativos.total).toBe(5);
      expect(resultado.listaEspera.filaAtual).toEqual(filaAtual);
      expect(resultado.atendimentos.taxaCancelamentoPercentual).toBe(20);
      expect(resultado.profissionais.ativos).toBe(3);
      expect(resultado.pacientes).not.toHaveProperty('periodo');
    });

    it('propaga falhas do banco', async () => {
      const erro = new Error('falha no banco');
      repository.atendimentos.mockRejectedValue(erro);

      await expect(service.geral()).rejects.toBe(erro);
    });
  });
});

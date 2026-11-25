import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PG_POOL } from '../../database/database.constants';
import { TipoRegistroClinico } from '../enum/historico-clinico.enum';
import { HistoricoClinicoService } from '../service/historico-clinico.service';

describe('HistoricoClinicoService', () => {
  let service: HistoricoClinicoService;
  const mockPool = { query: jest.fn() };

  const pacienteTea = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    numeroCadastro: 7,
    nome: 'Paciente Teste',
  };
  const paciente = {
    id: 3,
    numeroCadastro: 'AP-003',
    nome: 'Beneficiário Teste',
  };

  const registros = [
    {
      id: 'r2',
      tipo: 'avaliacao',
      dataRealizacao: '2026-10-07',
      titulo: 'Reavaliação',
      profissionalId: 'p1',
      profissionalNome: 'Profissional Teste',
    },
    {
      id: 'r1',
      tipo: 'atendimento',
      dataRealizacao: '2026-09-02',
      titulo: 'Sessão',
      profissionalId: 'p1',
      profissionalNome: 'Profissional Teste',
    },
  ];

  // 1ª consulta ao banco: busca o paciente. 2ª consulta: busca os registros dele.
  const simular = (
    pacienteEncontrado: object | null,
    registrosEncontrados: object[] = registros,
  ) => {
    mockPool.query
      .mockResolvedValueOnce({
        rows: pacienteEncontrado ? [pacienteEncontrado] : [],
      })
      .mockResolvedValueOnce({ rows: registrosEncontrados });
  };

  const sqlRegistros = () => String(mockPool.query.mock.calls[1][0]);
  const valoresRegistros = () => mockPool.query.mock.calls[1][1];

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoricoClinicoService,
        { provide: PG_POOL, useValue: mockPool },
      ],
    }).compile();

    service = module.get<HistoricoClinicoService>(HistoricoClinicoService);
  });

  // ---------- histórico de paciente de TEA ----------
  describe('listarPorPacienteTea', () => {
    it('devolve a identificação do paciente e seus registros consolidados (RN35)', async () => {
      simular(pacienteTea);

      const resultado = await service.listarPorPacienteTea(pacienteTea.id, {});

      expect(resultado.paciente).toEqual({
        origem: 'pacientes-tea',
        ...pacienteTea,
      });
      expect(resultado.total).toBe(2);
      expect(resultado.registros).toEqual(registros);
    });

    it('consulta somente os registros do paciente informado (RN36)', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {});

      expect(sqlRegistros()).toContain('r.paciente_tea_id = $1');
      expect(sqlRegistros()).not.toContain('r.paciente_id');
      expect(valoresRegistros()).toEqual([pacienteTea.id]);
    });

    it('ordena do registro mais recente para o mais antigo', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {});

      expect(sqlRegistros()).toContain('ORDER BY h."dataRealizacao" DESC');
    });

    it('lança NotFoundException quando a consulta não encontra o paciente (inexistente ou inativo)', async () => {
      simular(null);

      await expect(service.listarPorPaciente(paciente.id, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(String(mockPool.query.mock.calls[0][0])).toContain(
        'FROM pacientes WHERE id = $1 AND ativo = true',
      );
    });

    it('devolve lista vazia quando o paciente ainda não tem registros', async () => {
      simular(pacienteTea, []);

      const resultado = await service.listarPorPacienteTea(pacienteTea.id, {});

      expect(resultado.total).toBe(0);
      expect(resultado.registros).toEqual([]);
    });
  });

  // ---------- filtros ----------
  describe('filtros (RN38 e RN39)', () => {
    it('filtra por período completo', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {
        dataInicio: '2026-09-01',
        dataFim: '2026-09-30',
      });

      expect(sqlRegistros()).toContain('h."dataRealizacao" >= $2');
      expect(sqlRegistros()).toContain('h."dataRealizacao" <= $3');
      expect(valoresRegistros()).toEqual([
        pacienteTea.id,
        '2026-09-01',
        '2026-09-30',
      ]);
    });

    it('filtra apenas pela data inicial', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {
        dataInicio: '2026-10-01',
      });

      expect(sqlRegistros()).toContain('h."dataRealizacao" >= $2');
      expect(sqlRegistros()).not.toContain('h."dataRealizacao" <=');
      expect(valoresRegistros()).toEqual([pacienteTea.id, '2026-10-01']);
    });

    it('filtra apenas pela data final', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {
        dataFim: '2026-08-31',
      });

      expect(sqlRegistros()).toContain('h."dataRealizacao" <= $2');
      expect(sqlRegistros()).not.toContain('h."dataRealizacao" >=');
      expect(valoresRegistros()).toEqual([pacienteTea.id, '2026-08-31']);
    });

    it('filtra por tipo de registro', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {
        tipo: TipoRegistroClinico.AVALIACAO,
      });

      expect(sqlRegistros()).toContain('h.tipo = $2');
      expect(valoresRegistros()).toEqual([pacienteTea.id, 'avaliacao']);
    });

    it('combina período e tipo na mesma consulta', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {
        dataInicio: '2026-08-01',
        dataFim: '2026-09-30',
        tipo: TipoRegistroClinico.ATENDIMENTO,
      });

      expect(sqlRegistros()).toContain('h.tipo = $4');
      expect(valoresRegistros()).toEqual([
        pacienteTea.id,
        '2026-08-01',
        '2026-09-30',
        'atendimento',
      ]);
    });

    it('aceita um período de um único dia', async () => {
      simular(pacienteTea);

      await expect(
        service.listarPorPacienteTea(pacienteTea.id, {
          dataInicio: '2026-09-02',
          dataFim: '2026-09-02',
        }),
      ).resolves.toBeDefined();
    });

    it('recusa período em que a data inicial é posterior à final', async () => {
      await expect(
        service.listarPorPacienteTea(pacienteTea.id, {
          dataInicio: '2026-10-01',
          dataFim: '2026-09-01',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });

  // ---------- histórico de paciente do cadastro de aprendizagem ----------
  describe('listarPorPaciente', () => {
    it('devolve a identificação do paciente e seus registros', async () => {
      simular(paciente);

      const resultado = await service.listarPorPaciente(paciente.id, {});

      expect(resultado.paciente).toEqual({ origem: 'pacientes', ...paciente });
      expect(resultado.total).toBe(2);
    });

    it('consulta somente os registros do paciente informado (RN36)', async () => {
      simular(paciente);

      await service.listarPorPaciente(paciente.id, {});

      expect(sqlRegistros()).toContain('r.paciente_id = $1');
      expect(sqlRegistros()).not.toContain('paciente_tea_id');
      expect(valoresRegistros()).toEqual([paciente.id]);
    });

    it('lança NotFoundException quando a consulta não encontra o paciente (inexistente ou inativo)', async () => {
      simular(null);

      await expect(service.listarPorPaciente(paciente.id, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(String(mockPool.query.mock.calls[0][0])).toContain(
        'FROM pacientes WHERE id = $1 AND ativo = true',
      );
    });

    it.each([0, -1, 2147483648, 99999999999])(
      'lança NotFoundException sem consultar o banco quando o id (%p) está fora do limite',
      async (id) => {
        await expect(service.listarPorPaciente(id, {})).rejects.toThrow(
          NotFoundException,
        );
        expect(mockPool.query).not.toHaveBeenCalled();
      },
    );

    it('também aceita o filtro por tipo', async () => {
      simular(paciente);

      await service.listarPorPaciente(paciente.id, {
        tipo: TipoRegistroClinico.EVOLUCAO,
      });

      expect(sqlRegistros()).toContain('h.tipo = $2');
      expect(valoresRegistros()).toEqual([paciente.id, 'evolucao']);
    });
  });

  // atendimentos da agenda no histórico
  describe('atendimentos da agenda no histórico', () => {
    it('une os registros clínicos aos atendimentos do mesmo paciente de TEA', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {});

      expect(sqlRegistros()).toContain('FROM registros_clinicos r');
      expect(sqlRegistros()).toContain('UNION ALL');
      expect(sqlRegistros()).toContain('FROM atendimentos a');
      expect(sqlRegistros()).toContain('r.paciente_tea_id = $1');
      expect(sqlRegistros()).toContain('a.paciente_tea_id = $1');
      expect(valoresRegistros()).toEqual([pacienteTea.id]);
    });

    it('une os registros clínicos aos atendimentos do mesmo paciente do cadastro de aprendizagem', async () => {
      simular(paciente);

      await service.listarPorPaciente(paciente.id, {});

      expect(sqlRegistros()).toContain('r.paciente_id = $1');
      expect(sqlRegistros()).toContain('a.paciente_id = $1');
      expect(sqlRegistros()).not.toContain('paciente_tea_id');
      expect(valoresRegistros()).toEqual([paciente.id]);
    });

    it('inclui somente atendimentos que já aconteceram', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {});

      expect(sqlRegistros()).toContain('a.data_inicio < now()');
    });

    it('indica a origem de cada item e o status dos atendimentos (inclusive cancelados)', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {});

      expect(sqlRegistros()).toContain("'registro' AS origem");
      expect(sqlRegistros()).toContain("'atendimento' AS origem");
      expect(sqlRegistros()).toContain('a.status::text AS status');
      expect(sqlRegistros()).toContain('NULL::text AS status');
    });

    it('aplica o filtro de tipo sobre a lista já unida (atendimentos da agenda contam como "atendimento")', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {
        tipo: TipoRegistroClinico.ATENDIMENTO,
      });

      expect(sqlRegistros()).toContain(') h');
      expect(sqlRegistros()).toContain('WHERE h.tipo = $2');
      expect(valoresRegistros()).toEqual([pacienteTea.id, 'atendimento']);
    });

    it('aplica o período sobre a lista já unida', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {
        dataInicio: '2026-09-01',
        dataFim: '2026-09-30',
      });

      expect(sqlRegistros()).toContain(
        'WHERE h."dataRealizacao" >= $2 AND h."dataRealizacao" <= $3',
      );
    });

    it('ordena a lista unida do mais recente para o mais antigo', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {});

      expect(sqlRegistros()).toContain(
        'ORDER BY h."dataRealizacao" DESC, h.ordem DESC',
      );
    });

    it('sem filtros, não aplica nenhum WHERE sobre a lista unida', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {});

      expect(sqlRegistros()).not.toContain('WHERE h.');
    });
  });

  // ---------- RN37: informações do atendimento no detalhe ----------
  describe('detalhe com informações do atendimento (RN37)', () => {
    it('traz tipo, data e status do atendimento quando o registro está vinculado a um', async () => {
      const detalheComAtendimento = {
        id: 'r1',
        tipo: 'avaliacao',
        dataRealizacao: '2026-09-02',
        titulo: 'Avaliação',
        descricao: 'Descrição',
        avaliacoes: 'Avaliação X',
        procedimentos: null,
        atendimentoId: 'a1',
        atendimento: {
          id: 'a1',
          tipo: 'psicologia',
          dataInicio: '2026-09-02T12:00:00+00:00',
          status: 'agendado',
        },
        profissionalId: 'p1',
        profissionalNome: 'Profissional Teste',
      };
      mockPool.query.mockResolvedValueOnce({ rows: [detalheComAtendimento] });

      const resultado = await service.buscarRegistro('r1');

      expect(resultado.atendimento).toEqual(detalheComAtendimento.atendimento);
      const sql = String(mockPool.query.mock.calls[0][0]);
      expect(sql).toContain(
        'LEFT JOIN atendimentos a ON a.id = r.atendimento_id',
      );
      expect(sql).toContain('jsonb_build_object');
    });
  });

  // ---------- detalhes de um registro ----------
  describe('buscarRegistro', () => {
    const detalhe = {
      id: 'r1',
      tipo: 'atendimento',
      dataRealizacao: '2026-09-02',
      titulo: 'Sessão',
      descricao: 'Descrição completa do atendimento',
      avaliacoes: null,
      procedimentos: 'Protocolo sensorial',
      atendimentoId: null,
      profissionalId: 'p1',
      profissionalNome: 'Profissional Teste',
      profissionalArea: 'voluntariado_saude',
      origemPaciente: 'pacientes-tea',
      pacienteId: pacienteTea.id,
      pacienteNome: 'Paciente Teste',
    };

    it('devolve o registro com profissional, data, avaliações e procedimentos (RN37)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [detalhe] });

      const resultado = await service.buscarRegistro('r1');

      expect(resultado).toEqual(detalhe);
      expect(String(mockPool.query.mock.calls[0][0])).toContain('r.id = $1');
      expect(mockPool.query.mock.calls[0][1]).toEqual(['r1']);
    });

    it('só considera registros de pacientes ativos (TEA ou aprendizagem)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [detalhe] });

      await service.buscarRegistro('r1');

      expect(String(mockPool.query.mock.calls[0][0])).toContain(
        'COALESCE(pt.ativo, p.ativo) = true',
      );
    });

    it('lança NotFoundException quando o registro não existe', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.buscarRegistro('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

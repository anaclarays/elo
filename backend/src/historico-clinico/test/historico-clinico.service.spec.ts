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

      expect(sqlRegistros()).toContain('ORDER BY r.data_realizacao DESC');
    });

    it('lança NotFoundException quando o paciente não existe ou está inativo', async () => {
      simular(null);

      await expect(
        service.listarPorPacienteTea(pacienteTea.id, {}),
      ).rejects.toThrow(NotFoundException);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(String(mockPool.query.mock.calls[0][0])).toContain('ativo = true');
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

      expect(sqlRegistros()).toContain('r.data_realizacao >= $2');
      expect(sqlRegistros()).toContain('r.data_realizacao <= $3');
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

      expect(sqlRegistros()).toContain('r.data_realizacao >= $2');
      expect(sqlRegistros()).not.toContain('r.data_realizacao <=');
      expect(valoresRegistros()).toEqual([pacienteTea.id, '2026-10-01']);
    });

    it('filtra apenas pela data final', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {
        dataFim: '2026-08-31',
      });

      expect(sqlRegistros()).toContain('r.data_realizacao <= $2');
      expect(sqlRegistros()).not.toContain('r.data_realizacao >=');
      expect(valoresRegistros()).toEqual([pacienteTea.id, '2026-08-31']);
    });

    it('filtra por tipo de registro', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {
        tipo: TipoRegistroClinico.AVALIACAO,
      });

      expect(sqlRegistros()).toContain('r.tipo = $2');
      expect(valoresRegistros()).toEqual([pacienteTea.id, 'avaliacao']);
    });

    it('combina período e tipo na mesma consulta', async () => {
      simular(pacienteTea);

      await service.listarPorPacienteTea(pacienteTea.id, {
        dataInicio: '2026-08-01',
        dataFim: '2026-09-30',
        tipo: TipoRegistroClinico.ATENDIMENTO,
      });

      expect(sqlRegistros()).toContain('r.tipo = $4');
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

    it('lança NotFoundException quando o paciente não existe ou está inativo', async () => {
      simular(null);

      await expect(service.listarPorPaciente(paciente.id, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('também aceita o filtro por tipo', async () => {
      simular(paciente);

      await service.listarPorPaciente(paciente.id, {
        tipo: TipoRegistroClinico.EVOLUCAO,
      });

      expect(sqlRegistros()).toContain('r.tipo = $2');
      expect(valoresRegistros()).toEqual([paciente.id, 'evolucao']);
    });
  });

  // ---------- detalhe de um registro ----------
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

    it('só considera registros de pacientes ativos', async () => {
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

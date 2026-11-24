import type { Pool } from 'pg';
import { RelatoriosRepository } from '../relatorios.repository';

describe('RelatoriosRepository', () => {
  let repository: RelatoriosRepository;
  const client = { query: jest.fn(), release: jest.fn() };
  const pool = { query: jest.fn(), connect: jest.fn() };
  const executor = { query: jest.fn() };

  const novembro = { dataInicio: '2026-11-01', dataFim: '2026-11-30' };
  const semPeriodo = { dataInicio: null, dataFim: null };

  const sqlDaChamada = (indice = 0) =>
    String(executor.query.mock.calls[indice][0]);
  const valoresDaChamada = (indice = 0) => executor.query.mock.calls[indice][1];

  beforeEach(() => {
    jest.resetAllMocks();
    pool.connect.mockResolvedValue(client);
    client.query.mockResolvedValue({ rows: [] });
    executor.query.mockResolvedValue({ rows: [{}] });
    repository = new RelatoriosRepository(pool as unknown as Pool);
  });

  describe('emLeitura', () => {
    const comandos = () => client.query.mock.calls.map(([sql]) => sql);

    it('roda as consultas numa transação somente leitura e devolve o resultado', async () => {
      const resultado = await repository.emLeitura(async (c) => {
        await c.query('SELECT 1');
        return 'ok';
      });

      expect(resultado).toBe('ok');
      expect(comandos()).toEqual([
        'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
        'SELECT 1',
        'COMMIT',
      ]);
      expect(client.release).toHaveBeenCalledTimes(1);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('faz ROLLBACK, libera a conexão e propaga o erro quando uma consulta falha', async () => {
      const erro = new Error('falha no banco');

      await expect(
        repository.emLeitura(async () => {
          throw erro;
        }),
      ).rejects.toBe(erro);

      expect(comandos()).toEqual([
        'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
        'ROLLBACK',
      ]);
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('consultas', () => {
    const consultas: [string, () => Promise<unknown>][] = [
      ['pacientesAtivos', () => repository.pacientesAtivos(executor)],
      [
        'pacientesCadastrados',
        () => repository.pacientesCadastrados(executor, novembro),
      ],
      ['filaAtual', () => repository.filaAtual(executor)],
      ['movimentoFila', () => repository.movimentoFila(executor, novembro)],
      ['atendimentos', () => repository.atendimentos(executor, novembro)],
      [
        'atendimentosPorTipo',
        () => repository.atendimentosPorTipo(executor, novembro),
      ],
      [
        'atendimentosPorProfissional',
        () => repository.atendimentosPorProfissional(executor, novembro),
      ],
      [
        'profissionaisPorArea',
        () => repository.profissionaisPorArea(executor, novembro),
      ],
    ];

    it.each(consultas)(
      '%s só lê dados, nunca altera registros',
      async (_nome, consultar) => {
        await consultar();

        const sql = sqlDaChamada();
        expect(sql.trimStart()).toMatch(/^(SELECT|WITH)\b/);
        expect(sql).not.toMatch(
          /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i,
        );
      },
    );

    it.each(consultas)(
      '%s usa o executor recebido',
      async (_nome, consultar) => {
        await consultar();

        expect(executor.query).toHaveBeenCalledTimes(1);
        expect(pool.query).not.toHaveBeenCalled();
      },
    );
  });

  describe('filtro por período', () => {
    it('passa as datas como parâmetros, e não no texto da consulta', async () => {
      await repository.atendimentos(executor, novembro);

      expect(valoresDaChamada()).toEqual(['2026-11-01', '2026-11-30']);
      expect(sqlDaChamada()).not.toContain('2026-11');
    });

    it('envia null para os lados do período que não foram informados', async () => {
      await repository.movimentoFila(executor, semPeriodo);

      expect(valoresDaChamada()).toEqual([null, null]);
      expect(sqlDaChamada()).toContain('$1::date IS NULL');
      expect(sqlDaChamada()).toContain('$2::date IS NULL');
    });

    it('converte datas com hora para o dia no fuso de Recife', async () => {
      await repository.atendimentos(executor, novembro);

      expect(sqlDaChamada()).toContain(
        "(data_inicio AT TIME ZONE 'America/Recife')::date >= $1::date",
      );
    });

    it('compara colunas que já são data sem converter fuso', async () => {
      await repository.pacientesCadastrados(executor, novembro);

      const sql = sqlDaChamada();
      expect(sql).toContain('data_cadastro >= $1::date');
      expect(sql).toContain("(data_cadastro AT TIME ZONE 'America/Recife')");
    });
  });

  describe('critérios de contagem', () => {
    it('conta só pacientes com cadastro ativo', async () => {
      await repository.pacientesAtivos(executor);

      const sql = sqlDaChamada();
      expect(sql).toContain('FROM pacientes WHERE ativo = true');
      expect(sql).toContain('FROM pacientes_tea WHERE ativo = true');
    });

    it('classifica a faixa etária pelas mesmas idades do cadastro TEA', async () => {
      await repository.pacientesAtivos(executor);

      const sql = sqlDaChamada();
      expect(sql).toContain('idade <= 11');
      expect(sql).toContain('idade BETWEEN 12 AND 17');
      expect(sql).toContain('idade BETWEEN 18 AND 59');
      expect(sql).toContain('idade >= 60');
    });

    it('usa na fila atual os mesmos critérios da tela da lista de espera', async () => {
      await repository.filaAtual(executor);

      const sql = sqlDaChamada();
      expect(sql).toContain('le.data_saida IS NULL');
      expect(sql).toContain('p.ativo = true');
      expect(sql).toContain('pt.ativo = true');
    });

    it('conta cada paciente uma vez só, mesmo com vários atendimentos', async () => {
      await repository.atendimentos(executor, novembro);

      expect(sqlDaChamada()).toContain(
        'count(DISTINCT COALESCE(paciente_id::text, paciente_tea_id::text))',
      );
    });

    it('não conta atendimentos cancelados por tipo nem por profissional', async () => {
      await repository.atendimentosPorTipo(executor, novembro);
      await repository.atendimentosPorProfissional(executor, novembro);

      expect(sqlDaChamada(0)).toContain("a.status = 'agendado'");
      expect(sqlDaChamada(1)).toContain("a.status = 'agendado'");
    });

    it('lista todos os tipos de atendimento, mesmo sem nenhum no período', async () => {
      await repository.atendimentosPorTipo(executor, novembro);

      expect(sqlDaChamada()).toContain(
        'unnest(enum_range(NULL::tipo_atendimento))',
      );
    });

    it('conta só profissionais ativos', async () => {
      await repository.profissionaisPorArea(executor, novembro);

      expect(sqlDaChamada()).toContain('WHERE ativo = true');
    });
  });

  describe('retorno', () => {
    it('devolve a linha única das consultas de totais', async () => {
      executor.query.mockResolvedValueOnce({ rows: [{ total: 3 }] });

      await expect(repository.filaAtual(executor)).resolves.toEqual({
        total: 3,
      });
    });

    it('devolve todas as linhas das consultas agrupadas', async () => {
      const linhas = [
        { tipo: 'psicologia', total: 2 },
        { tipo: 'pedagogia', total: 1 },
      ];
      executor.query.mockResolvedValueOnce({ rows: linhas });

      await expect(
        repository.atendimentosPorTipo(executor, novembro),
      ).resolves.toEqual(linhas);
    });
  });
});

import { Pool } from 'pg';
import { AreaAtuacao } from '../../profissionais/dto/create-profissional.dto';
import { TipoSugestao } from '../sugestoes.regras';
import { Decisao, SugestoesRepository } from '../sugestoes.repository';

describe('SugestoesRepository', () => {
  const pool = { query: jest.fn() };
  const repository = new SugestoesRepository(pool as unknown as Pool);

  beforeEach(() => {
    jest.resetAllMocks();
    pool.query.mockResolvedValue({ rows: [] });
  });

  it('lista só profissionais ativos que atendem', async () => {
    await repository.listarProfissionais();

    const [sql, valores] = pool.query.mock.calls[0];
    expect(sql).toContain('ativo = true');
    expect(sql).toContain("<> 'inativo'");
    expect(valores).toEqual([AreaAtuacao.COORDENACAO_ADMINISTRATIVA]);
  });

  it('lista os atendimentos agendados no período', async () => {
    const desde = new Date('2026-11-23T03:00:00Z');
    const ate = new Date('2026-12-25T03:00:00Z');

    await repository.listarAgendados(desde, ate);

    const [sql, valores] = pool.query.mock.calls[0];
    expect(sql).toContain("a.status = 'agendado'");
    expect(valores).toEqual([desde, ate]);
  });

  it('devolve os ids decididos como conjunto', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ sugestaoId: 'a' }, { sugestaoId: 'b' }],
    });

    await expect(repository.listarIdsDecididos()).resolves.toEqual(
      new Set(['a', 'b']),
    );
  });

  describe('registrarDecisao', () => {
    const decisao = {
      sugestaoId: 'a'.repeat(24),
      tipo: TipoSugestao.VAGA_FILA,
      titulo: 'Agendar Família Silva com Bruno',
      decisao: Decisao.APROVADA,
      motivo: null,
      profissionais: ['prof-1'],
      decididoPor: 'usuario-1',
    };

    it('grava a decisão sem sobrescrever uma existente', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'decisao-1' }] });

      await expect(repository.registrarDecisao(decisao)).resolves.toEqual({
        id: 'decisao-1',
      });
      const [sql, valores] = pool.query.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (sugestao_id) DO NOTHING');
      expect(valores).toEqual([
        decisao.sugestaoId,
        decisao.tipo,
        decisao.titulo,
        decisao.decisao,
        null,
        ['prof-1'],
        'usuario-1',
      ]);
    });

    it('devolve null quando a sugestão já tinha decisão', async () => {
      await expect(repository.registrarDecisao(decisao)).resolves.toBeNull();
    });
  });

  it('remove a decisão pelo id da sugestão', async () => {
    await repository.removerDecisao('abc');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM decisoes_sugestoes'),
      ['abc'],
    );
  });

  it('lista o histórico mais recente primeiro, com o nome de quem decidiu', async () => {
    await repository.listarHistorico();

    const [sql, valores] = pool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY d.decidido_em DESC');
    expect(sql).toContain('"decididoPorNome"');
    expect(sql).not.toContain('ANY');
    expect(valores).toEqual([50]);
  });

  it('filtra o histórico do voluntário pelas decisões que o envolviam', async () => {
    await repository.listarHistorico('prof-1');

    const [sql, valores] = pool.query.mock.calls[0];
    expect(sql).toContain('$2 = ANY(d.profissionais)');
    expect(valores).toEqual([50, 'prof-1']);
  });
});

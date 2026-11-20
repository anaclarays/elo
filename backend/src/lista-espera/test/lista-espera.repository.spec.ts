import type { Pool } from 'pg';
import { MotivoSaida, TipoPaciente } from '../enum/lista-espera.enum';
import { ListaEsperaRepository } from '../lista-espera.repository';

describe('ListaEsperaRepository', () => {
  let repository: ListaEsperaRepository;
  const pool = { query: jest.fn() };

  const pacienteTea = {
    tipo: TipoPaciente.TEA,
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  };
  const beneficiario = { tipo: TipoPaciente.BENEFICIARIO, id: 7 };

  const sqlDaChamada = (indice = 0) => String(pool.query.mock.calls[indice][0]);
  const valoresDaChamada = (indice = 0) => pool.query.mock.calls[indice][1];

  beforeEach(() => {
    jest.resetAllMocks();
    pool.query.mockResolvedValue({ rows: [] });
    repository = new ListaEsperaRepository(pool as unknown as Pool);
  });

  describe('registrar', () => {
    it('grava paciente comum na coluna paciente_id', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });

      const resultado = await repository.registrar(beneficiario);

      expect(sqlDaChamada()).toContain(
        'INSERT INTO lista_espera (paciente_id)',
      );
      expect(valoresDaChamada()).toEqual([7]);
      expect(resultado).toEqual({ id: 'r1' });
    });

    it('grava paciente TEA na coluna paciente_tea_id', async () => {
      await repository.registrar(pacienteTea);

      expect(sqlDaChamada()).toContain(
        'INSERT INTO lista_espera (paciente_tea_id)',
      );
      expect(valoresDaChamada()).toEqual([pacienteTea.id]);
    });

    it('usa o client da transação quando recebido, e não o pool', async () => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [{}] }) };

      await repository.registrar(pacienteTea, client);

      expect(client.query).toHaveBeenCalledTimes(1);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe('pacienteAtivoExiste', () => {
    it.each([
      [beneficiario, 'FROM pacientes WHERE'],
      [pacienteTea, 'FROM pacientes_tea WHERE'],
    ])(
      'consulta a tabela certa e só cadastros ativos',
      async (paciente, trecho) => {
        pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

        await expect(repository.pacienteAtivoExiste(paciente)).resolves.toBe(
          true,
        );
        expect(sqlDaChamada()).toContain(trecho);
        expect(sqlDaChamada()).toContain('ativo = true');
      },
    );

    it('devolve false quando o paciente não existe', async () => {
      await expect(repository.pacienteAtivoExiste(beneficiario)).resolves.toBe(
        false,
      );
    });
  });

  describe('existeRegistroAtivo', () => {
    it('considera apenas registros sem data de saída (RN31)', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{}] });

      await expect(repository.existeRegistroAtivo(pacienteTea)).resolves.toBe(
        true,
      );
      expect(sqlDaChamada()).toContain('paciente_tea_id = $1');
      expect(sqlDaChamada()).toContain('data_saida IS NULL');
    });

    it('devolve false quando não há registro ativo', async () => {
      await expect(repository.existeRegistroAtivo(beneficiario)).resolves.toBe(
        false,
      );
    });
  });

  describe('listarFila', () => {
    it('ordena por data de entrada, a mais antiga primeiro (RN34)', async () => {
      await repository.listarFila();

      expect(sqlDaChamada()).toContain(
        'ROW_NUMBER() OVER (ORDER BY le.data_entrada, le.id)',
      );
      expect(sqlDaChamada()).toMatch(/ORDER BY posicao\s*$/);
    });

    it('traz só registros ativos de pacientes com cadastro ativo', async () => {
      await repository.listarFila();

      const sql = sqlDaChamada();
      expect(sql).toContain('le.data_saida IS NULL');
      expect(sql).toContain('p.ativo = true');
      expect(sql).toContain('pt.ativo = true');
    });

    it('sem filtros, não aplica WHERE sobre a fila', async () => {
      await repository.listarFila();

      expect(sqlDaChamada()).toContain('SELECT * FROM fila  ORDER BY posicao');
      expect(valoresDaChamada()).toEqual([]);
    });

    it('aplica os filtros depois de calcular a posição (a posição é a da fila inteira)', async () => {
      await repository.listarFila({ tipo: TipoPaciente.TEA, nome: ' ana ' });

      const sql = sqlDaChamada();
      const posicaoCalculada = sql.indexOf('ROW_NUMBER()');
      const filtro = sql.indexOf('WHERE "tipoPaciente" = $1 AND nome ILIKE $2');
      expect(filtro).toBeGreaterThan(posicaoCalculada);
      expect(valoresDaChamada()).toEqual([TipoPaciente.TEA, '%ana%']);
    });

    it('ignora filtro de nome em branco', async () => {
      await repository.listarFila({ nome: '   ' });

      expect(valoresDaChamada()).toEqual([]);
    });

    it('devolve as linhas do banco', async () => {
      const linhas = [{ id: 'r1', posicao: 1 }];
      pool.query.mockResolvedValueOnce({ rows: linhas });

      await expect(repository.listarFila()).resolves.toEqual(linhas);
    });
  });

  describe('encerrar', () => {
    it('encerra só registro ativo e grava motivo, justificativa e quem retirou', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });

      const resultado = await repository.encerrar('r1', MotivoSaida.MANUAL, {
        justificativa: 'Mudou de cidade',
        retiradoPor: 'prof-1',
      });

      expect(sqlDaChamada()).toContain('WHERE id = $1 AND data_saida IS NULL');
      expect(valoresDaChamada()).toEqual([
        'r1',
        MotivoSaida.MANUAL,
        'Mudou de cidade',
        'prof-1',
      ]);
      expect(resultado).toEqual({ id: 'r1' });
    });

    it('devolve null quando o registro não existe ou já foi encerrado', async () => {
      await expect(
        repository.encerrar('r1', MotivoSaida.MANUAL),
      ).resolves.toBeNull();
      expect(valoresDaChamada()).toEqual([
        'r1',
        MotivoSaida.MANUAL,
        null,
        null,
      ]);
    });
  });

  describe('encerrarPorPaciente', () => {
    it('encerra o registro ativo do paciente', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });

      await expect(
        repository.encerrarPorPaciente(beneficiario, MotivoSaida.AGENDAMENTO),
      ).resolves.toBe(true);
      expect(sqlDaChamada()).toContain(
        'WHERE paciente_id = $1 AND data_saida IS NULL',
      );
      expect(valoresDaChamada()).toEqual([7, MotivoSaida.AGENDAMENTO]);
    });

    it('devolve false quando o paciente não estava na lista', async () => {
      await expect(
        repository.encerrarPorPaciente(pacienteTea, MotivoSaida.AGENDAMENTO),
      ).resolves.toBe(false);
    });

    it('usa o client da transação quando recebido', async () => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };

      await repository.encerrarPorPaciente(
        pacienteTea,
        MotivoSaida.AGENDAMENTO,
        client,
      );

      expect(client.query).toHaveBeenCalledTimes(1);
      expect(pool.query).not.toHaveBeenCalled();
    });
  });
});

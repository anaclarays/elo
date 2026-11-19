import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MotivoSaida, TipoPaciente } from '../enum/lista-espera.enum';
import { ListaEsperaRepository } from '../lista-espera.repository';
import { ListaEsperaService } from '../service/lista-espera.service';

describe('ListaEsperaService', () => {
  let service: ListaEsperaService;

  const repository = {
    registrar: jest.fn(),
    pacienteAtivoExiste: jest.fn(),
    existeRegistroAtivo: jest.fn(),
    listarFila: jest.fn(),
    encerrar: jest.fn(),
    encerrarPorPaciente: jest.fn(),
  };

  const pacienteTea = {
    tipo: TipoPaciente.TEA,
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  };
  const beneficiario = { tipo: TipoPaciente.BENEFICIARIO, id: 7 };
  const idRegistro = 'b1ffcd88-8d1a-4ef8-bb6d-6bb9bd380a22';
  const idProfissional = 'c2aade77-7e2b-4ef8-bb6d-6bb9bd380a33';

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ListaEsperaService(
      repository as unknown as ListaEsperaRepository,
    );
  });

  // ---------- RN28: registro automático no cadastro ----------
  describe('registrarNoCadastro', () => {
    it('registra o paciente usando o client da transação recebida', async () => {
      const client = { query: jest.fn() };
      repository.registrar.mockResolvedValueOnce({ id: idRegistro });

      const resultado = await service.registrarNoCadastro(pacienteTea, client);

      expect(repository.registrar).toHaveBeenCalledWith(pacienteTea, client);
      expect(resultado).toEqual({ id: idRegistro });
    });

    it('usa a conexão padrão quando não há transação', async () => {
      await service.registrarNoCadastro(beneficiario);

      expect(repository.registrar).toHaveBeenCalledWith(
        beneficiario,
        undefined,
      );
    });

    it('propaga falhas do banco para o cadastro poder desfazer a gravação', async () => {
      const erro = new Error('falha no banco');
      repository.registrar.mockRejectedValueOnce(erro);

      await expect(service.registrarNoCadastro(beneficiario)).rejects.toBe(
        erro,
      );
    });
  });

  // ---------- RN30 / RN34: consulta ----------
  describe('consultar', () => {
    it('devolve a fila do repositório, na ordem recebida', async () => {
      const fila = [
        { id: '1', posicao: 1, nome: 'Primeira a chegar' },
        { id: '2', posicao: 2, nome: 'Segunda a chegar' },
      ];
      repository.listarFila.mockResolvedValueOnce(fila);

      const resultado = await service.consultar();

      expect(resultado).toEqual(fila);
    });

    it('repassa os filtros para o repositório', async () => {
      repository.listarFila.mockResolvedValueOnce([]);

      await service.consultar({ tipo: TipoPaciente.TEA, nome: 'ana' });

      expect(repository.listarFila).toHaveBeenCalledWith({
        tipo: TipoPaciente.TEA,
        nome: 'ana',
      });
    });

    it('devolve lista vazia quando ninguém aguarda atendimento', async () => {
      repository.listarFila.mockResolvedValueOnce([]);

      await expect(service.consultar()).resolves.toEqual([]);
    });
  });

  // ---------- RN29 + RN31: inclusão manual ----------
  describe('adicionarManualmente', () => {
    const dto = {
      tipoPaciente: TipoPaciente.TEA,
      pacienteId: pacienteTea.id,
    };

    it('inclui o paciente que não está na lista', async () => {
      repository.pacienteAtivoExiste.mockResolvedValueOnce(true);
      repository.existeRegistroAtivo.mockResolvedValueOnce(false);
      repository.registrar.mockResolvedValueOnce({ id: idRegistro });

      const resultado = await service.adicionarManualmente(dto);

      expect(repository.registrar).toHaveBeenCalledWith(pacienteTea);
      expect(resultado).toEqual({ id: idRegistro });
    });

    it('recusa paciente inexistente ou removido', async () => {
      repository.pacienteAtivoExiste.mockResolvedValueOnce(false);

      await expect(service.adicionarManualmente(dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.registrar).not.toHaveBeenCalled();
    });

    it('recusa paciente que já tem registro ativo na lista (RN31)', async () => {
      repository.pacienteAtivoExiste.mockResolvedValueOnce(true);
      repository.existeRegistroAtivo.mockResolvedValueOnce(true);

      await expect(service.adicionarManualmente(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.registrar).not.toHaveBeenCalled();
    });

    it('trata como conflito duas inclusões simultâneas barradas pelo banco (RN31)', async () => {
      repository.pacienteAtivoExiste.mockResolvedValueOnce(true);
      repository.existeRegistroAtivo.mockResolvedValueOnce(false);
      repository.registrar.mockRejectedValueOnce({ code: '23505' });

      await expect(service.adicionarManualmente(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('propaga outros erros do banco', async () => {
      const erro = new Error('falha no banco');
      repository.pacienteAtivoExiste.mockResolvedValueOnce(true);
      repository.existeRegistroAtivo.mockResolvedValueOnce(false);
      repository.registrar.mockRejectedValueOnce(erro);

      await expect(service.adicionarManualmente(dto)).rejects.toBe(erro);
    });
  });

  // ---------- RN33: retirada manual ----------
  describe('retirarManualmente', () => {
    it('encerra o registro guardando a justificativa e quem retirou', async () => {
      repository.encerrar.mockResolvedValueOnce({
        id: idRegistro,
        motivoSaida: MotivoSaida.MANUAL,
      });

      const resultado = await service.retirarManualmente(
        idRegistro,
        '  Família desistiu do atendimento  ',
        idProfissional,
      );

      expect(repository.encerrar).toHaveBeenCalledWith(
        idRegistro,
        MotivoSaida.MANUAL,
        {
          justificativa: 'Família desistiu do atendimento',
          retiradoPor: idProfissional,
        },
      );
      expect(resultado.motivoSaida).toBe(MotivoSaida.MANUAL);
    });

    it.each(['', '   '])(
      'recusa justificativa vazia (%j)',
      async (justificativa) => {
        await expect(
          service.retirarManualmente(idRegistro, justificativa, idProfissional),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(repository.encerrar).not.toHaveBeenCalled();
      },
    );

    it('recusa justificativa ausente', async () => {
      await expect(
        service.retirarManualmente(
          idRegistro,
          undefined as unknown as string,
          idProfissional,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('devolve 404 quando o registro não existe ou já foi encerrado', async () => {
      repository.encerrar.mockResolvedValueOnce(null);

      await expect(
        service.retirarManualmente(idRegistro, 'Motivo', idProfissional),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- RN29: saída por agendamento ----------
  describe('retirarPorAgendamento', () => {
    it('encerra o registro ativo do paciente com o motivo "agendamento"', async () => {
      const client = { query: jest.fn() };
      repository.encerrarPorPaciente.mockResolvedValueOnce(true);

      const resultado = await service.retirarPorAgendamento(
        beneficiario,
        client,
      );

      expect(repository.encerrarPorPaciente).toHaveBeenCalledWith(
        beneficiario,
        MotivoSaida.AGENDAMENTO,
        client,
      );
      expect(resultado).toBe(true);
    });

    it('não dá erro quando o paciente não está na lista', async () => {
      repository.encerrarPorPaciente.mockResolvedValueOnce(false);

      await expect(service.retirarPorAgendamento(pacienteTea)).resolves.toBe(
        false,
      );
    });
  });
});

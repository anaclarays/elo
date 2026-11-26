import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TipoAtendimento } from '../../atendimentos/dto/create-atendimento.dto';
import { AtendimentosService } from '../../atendimentos/service/atendimentos.service';
import { AreaAtuacao } from '../../profissionais/dto/create-profissional.dto';
import { ListaEsperaService } from '../../lista-espera/service/lista-espera.service';
import { SugestoesService } from '../service/sugestoes.service';
import { idSugestao, TipoSugestao } from '../sugestoes.regras';
import { Decisao, SugestoesRepository } from '../sugestoes.repository';

describe('SugestoesService', () => {
  let service: SugestoesService;

  const repository = {
    listarProfissionais: jest.fn(),
    listarAgendados: jest.fn(),
    listarIdsDecididos: jest.fn(),
    registrarDecisao: jest.fn(),
    removerDecisao: jest.fn(),
    listarHistorico: jest.fn(),
  };
  const atendimentosService = {
    create: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  };
  const listaEsperaService = { consultar: jest.fn() };

  const usuarioId = 'c2aade77-7e2b-4ef8-bb6d-6bb9bd380a33';
  const profissionalId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const coordenacao = { id: usuarioId, coordenacao: true };
  const voluntario = { id: profissionalId, coordenacao: false };
  const outroVoluntario = {
    id: 'e4ccf055-5a4d-4ef8-bb6d-6bb9bd380a55',
    coordenacao: false,
  };
  const idVaga = idSugestao(`vaga_fila:fila-1:${profissionalId}`);

  // Quarta-feira, 25/11/2026, 09:00 em Recife
  const agora = new Date('2026-11-25T09:00:00-03:00');

  const comUmaFamiliaNaFila = (
    tipoPaciente = 'beneficiario',
    pacienteId = '7',
  ) => {
    repository.listarProfissionais.mockResolvedValue([
      {
        id: profissionalId,
        nome: 'Bruno',
        area: AreaAtuacao.VOLUNTARIADO_SAUDE,
        capacidadeSemanal: 5,
        horarioInicio: '08:00',
        horarioFim: '12:00',
      },
    ]);
    repository.listarAgendados.mockResolvedValue([]);
    repository.listarIdsDecididos.mockResolvedValue(new Set());
    listaEsperaService.consultar.mockResolvedValue([
      {
        id: 'fila-1',
        posicao: '1',
        tipoPaciente,
        pacienteId,
        nome: 'Família Silva',
        dataEntrada: '2026-11-01T10:00:00.000Z',
      },
    ]);
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers({ now: agora, doNotFake: ['nextTick', 'setImmediate'] });
    service = new SugestoesService(
      repository as unknown as SugestoesRepository,
      atendimentosService as unknown as AtendimentosService,
      listaEsperaService as unknown as ListaEsperaService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('listar', () => {
    it('calcula as sugestões com a agenda da semana atual até 30 dias à frente', async () => {
      comUmaFamiliaNaFila();

      const resultado = await service.listar(coordenacao);

      expect(repository.listarAgendados).toHaveBeenCalledWith(
        new Date('2026-11-23T03:00:00.000Z'),
        new Date('2026-12-25T12:00:00.000Z'),
      );
      expect(resultado.geradasEm).toBe(agora.toISOString());
      expect(resultado.sugestoes).toEqual([
        expect.objectContaining({
          id: idVaga,
          tipo: TipoSugestao.VAGA_FILA,
          profissionais: [profissionalId],
          podeDecidir: true,
        }),
      ]);
    });
  });

  describe('aprovar', () => {
    it('registra a decisão e agenda o paciente da fila', async () => {
      comUmaFamiliaNaFila();
      repository.registrarDecisao.mockResolvedValueOnce({ id: 'decisao-1' });
      atendimentosService.create.mockResolvedValueOnce({ id: 'atendimento-1' });

      const resultado = await service.aprovar(idVaga, coordenacao);

      expect(repository.registrarDecisao).toHaveBeenCalledWith(
        expect.objectContaining({
          sugestaoId: idVaga,
          tipo: TipoSugestao.VAGA_FILA,
          decisao: Decisao.APROVADA,
          motivo: null,
          profissionais: [profissionalId],
          decididoPor: usuarioId,
        }),
      );
      expect(atendimentosService.create).toHaveBeenCalledWith({
        pacienteId: 7,
        isTea: false,
        profissionalId,
        dataInicio: new Date('2026-11-25T10:00:00-03:00'),
        tipo: TipoAtendimento.PSICOLOGIA,
      });
      expect(resultado).toEqual({
        decisao: { id: 'decisao-1' },
        resultado: { id: 'atendimento-1' },
      });
    });

    it('mantém o id em texto para paciente TEA', async () => {
      const pacienteTea = 'b1ffcd88-8d1a-4ef8-bb6d-6bb9bd380a22';
      comUmaFamiliaNaFila('tea', pacienteTea);
      repository.registrarDecisao.mockResolvedValueOnce({ id: 'decisao-1' });

      await service.aprovar(idVaga, coordenacao);

      expect(atendimentosService.create).toHaveBeenCalledWith(
        expect.objectContaining({ pacienteId: pacienteTea, isTea: true }),
      );
    });

    it('transfere o atendimento quando a sugestão é de sobrecarga', async () => {
      const outro = 'd3bbef66-6f3c-4ef8-bb6d-6bb9bd380a44';
      repository.listarProfissionais.mockResolvedValue([
        {
          id: profissionalId,
          nome: 'Ana',
          area: AreaAtuacao.VOLUNTARIADO_SAUDE,
          capacidadeSemanal: 1,
          horarioInicio: '08:00',
          horarioFim: '12:00',
        },
        {
          id: outro,
          nome: 'Bruno',
          area: AreaAtuacao.VOLUNTARIADO_SAUDE,
          capacidadeSemanal: 5,
          horarioInicio: '08:00',
          horarioFim: '12:00',
        },
      ]);
      repository.listarAgendados.mockResolvedValue(
        ['08:00', '09:00'].map((hora, i) => ({
          id: `at-${i}`,
          profissionalId,
          pacienteId: String(i + 1),
          isTea: false,
          pacienteNome: `Paciente ${i}`,
          dataInicio: `2026-11-26T${hora}:00-03:00`,
          tipo: TipoAtendimento.PSICOLOGIA,
        })),
      );
      repository.listarIdsDecididos.mockResolvedValue(new Set());
      listaEsperaService.consultar.mockResolvedValue([]);
      repository.registrarDecisao.mockResolvedValueOnce({ id: 'decisao-1' });

      await service.aprovar(
        idSugestao(`sobrecarga:at-1:${outro}`),
        coordenacao,
      );

      expect(atendimentosService.update).toHaveBeenCalledWith('at-1', {
        profissionalId: outro,
      });
    });

    it('cancela os atendimentos excedentes quando a sugestão é de redução', async () => {
      comUmaFamiliaNaFila();
      const dias = ['11-26', '12-01', '12-03', '12-08', '12-10'];
      repository.listarAgendados.mockResolvedValue(
        dias.map((dia, i) => ({
          id: `at-${i}`,
          profissionalId,
          pacienteId: '3',
          isTea: false,
          pacienteNome: 'João',
          dataInicio: `2026-${dia}T08:00:00-03:00`,
          tipo: TipoAtendimento.PSICOLOGIA,
        })),
      );
      repository.registrarDecisao.mockResolvedValueOnce({ id: 'decisao-1' });

      await service.aprovar(
        idSugestao('reducao_frequencia:beneficiario:3:at-4'),
        coordenacao,
      );

      expect(atendimentosService.cancel).toHaveBeenCalledTimes(1);
      expect(atendimentosService.cancel).toHaveBeenCalledWith(
        'at-4',
        'Redução de frequência sugerida pelo sistema e aprovada em Sugestões de IA',
      );
    });

    it('recusa uma sugestão que não está mais disponível', async () => {
      comUmaFamiliaNaFila();

      await expect(
        service.aprovar('f'.repeat(24), coordenacao),
      ).rejects.toThrow(NotFoundException);
      expect(repository.registrarDecisao).not.toHaveBeenCalled();
    });

    it('recusa aprovar duas vezes a mesma sugestão', async () => {
      comUmaFamiliaNaFila();
      repository.registrarDecisao.mockResolvedValueOnce(null);

      await expect(service.aprovar(idVaga, coordenacao)).rejects.toThrow(
        ConflictException,
      );
      expect(atendimentosService.create).not.toHaveBeenCalled();
    });

    it('desfaz a decisão quando a agenda recusa a ação', async () => {
      comUmaFamiliaNaFila();
      repository.registrarDecisao.mockResolvedValueOnce({ id: 'decisao-1' });
      atendimentosService.create.mockRejectedValueOnce(
        new BadRequestException('Conflito de horário'),
      );

      await expect(service.aprovar(idVaga, coordenacao)).rejects.toThrow(
        'Conflito de horário',
      );
      expect(repository.removerDecisao).toHaveBeenCalledWith(idVaga);
    });
  });

  describe('descartar', () => {
    it('registra o descarte com o motivo, sem mexer na agenda', async () => {
      comUmaFamiliaNaFila();
      repository.registrarDecisao.mockResolvedValueOnce({ id: 'decisao-1' });

      await service.descartar(
        idVaga,
        'Família pediu outro horário',
        coordenacao,
      );

      expect(repository.registrarDecisao).toHaveBeenCalledWith(
        expect.objectContaining({
          sugestaoId: idVaga,
          decisao: Decisao.DESCARTADA,
          motivo: 'Família pediu outro horário',
        }),
      );
      expect(atendimentosService.create).not.toHaveBeenCalled();
    });

    it('recusa descartar uma sugestão já decidida', async () => {
      comUmaFamiliaNaFila();
      repository.registrarDecisao.mockResolvedValueOnce(null);

      await expect(
        service.descartar(idVaga, 'motivo', coordenacao),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('voluntário', () => {
    it('vê só as sugestões que mudam a própria agenda, podendo decidir', async () => {
      comUmaFamiliaNaFila();

      const dele = await service.listar(voluntario);
      const deOutro = await service.listar(outroVoluntario);

      expect(dele.sugestoes).toEqual([
        expect.objectContaining({ id: idVaga, podeDecidir: true }),
      ]);
      expect(deOutro.sugestoes).toEqual([]);
    });

    it('aprova uma sugestão da própria agenda', async () => {
      comUmaFamiliaNaFila();
      repository.registrarDecisao.mockResolvedValueOnce({ id: 'decisao-1' });

      await service.aprovar(idVaga, voluntario);

      expect(repository.registrarDecisao).toHaveBeenCalledWith(
        expect.objectContaining({ decididoPor: profissionalId }),
      );
      expect(atendimentosService.create).toHaveBeenCalled();
    });

    it('não decide sugestão de outro profissional', async () => {
      comUmaFamiliaNaFila();

      await expect(
        service.descartar(idVaga, 'motivo', outroVoluntario),
      ).rejects.toThrow(NotFoundException);
      expect(repository.registrarDecisao).not.toHaveBeenCalled();
    });

    it('vê, mas não decide, redução que cancela atendimento de outro profissional', async () => {
      comUmaFamiliaNaFila();
      const outro = outroVoluntario.id;
      repository.listarAgendados.mockResolvedValue(
        ['11-26', '12-01', '12-03', '12-08', '12-10', '12-15'].map(
          (dia, i) => ({
            id: `at-${i}`,
            profissionalId: i === 5 ? outro : profissionalId,
            pacienteId: '3',
            isTea: false,
            pacienteNome: 'João',
            dataInicio: `2026-${dia}T08:00:00-03:00`,
            tipo: TipoAtendimento.PSICOLOGIA,
          }),
        ),
      );
      const idReducao = idSugestao(
        'reducao_frequencia:beneficiario:3:at-4,at-5',
      );

      const { sugestoes } = await service.listar(voluntario);

      expect(sugestoes).toContainEqual(
        expect.objectContaining({ id: idReducao, podeDecidir: false }),
      );
      await expect(service.aprovar(idReducao, voluntario)).rejects.toThrow(
        ForbiddenException,
      );
      expect(atendimentosService.cancel).not.toHaveBeenCalled();
    });

    it('vê no histórico só as decisões que o envolviam', async () => {
      await service.historico(voluntario);
      expect(repository.listarHistorico).toHaveBeenCalledWith(profissionalId);
    });
  });

  it('historico da coordenação lista todas as decisões', async () => {
    await service.historico(coordenacao);
    expect(repository.listarHistorico).toHaveBeenCalledWith(undefined);
  });

  it('historico delega para o repositório', async () => {
    repository.listarHistorico.mockResolvedValueOnce([{ id: 'decisao-1' }]);

    await expect(service.historico(coordenacao)).resolves.toEqual([
      { id: 'decisao-1' },
    ]);
  });
});

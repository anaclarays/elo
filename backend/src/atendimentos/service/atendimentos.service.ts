import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateAtendimentoDto } from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';
import { AtendimentosRepository } from '../atendimentos.repository';
import { ProfissionaisService } from '../../profissionais/service/profissionais.service';
import {
  PacienteRef,
  TipoPaciente,
} from '../../lista-espera/enum/lista-espera.enum';
import { ListaEsperaService } from '../../lista-espera/service/lista-espera.service';

@Injectable()
export class AtendimentosService {
  constructor(
    private readonly atendimentosRepository: AtendimentosRepository,
    private readonly profissionaisService: ProfissionaisService,
    private readonly listaEsperaService: ListaEsperaService,
  ) {}

  async create(createAtendimentoDto: CreateAtendimentoDto) {
    await this.validateTimes(createAtendimentoDto);

    // O paciente agendado sai da lista de espera na mesma transação
    return this.atendimentosRepository.emTransacao(async (client) => {
      const atendimento = await this.atendimentosRepository.create(
        createAtendimentoDto,
        client,
      );
      await this.listaEsperaService.retirarPorAgendamento(
        this.pacienteRef(createAtendimentoDto),
        client,
      );
      return atendimento;
    });
  }

  findAll() {
    return this.atendimentosRepository.findAll();
  }

  async findOne(id: string) {
    const atendimento = await this.atendimentosRepository.findOne(id);
    if (!atendimento) {
      throw new NotFoundException(`Atendimento com id ${id} não encontrado.`);
    }
    return atendimento;
  }

  async update(id: string, updateAtendimentoDto: UpdateAtendimentoDto) {
    if (Object.keys(updateAtendimentoDto).length === 0) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
      );
    }

    const atendimentoAtual = await this.atendimentosRepository.findOne(id);
    if (!atendimentoAtual) {
      throw new NotFoundException(`Atendimento com id ${id} não encontrado.`);
    }

    const mudouTipoPaciente =
      updateAtendimentoDto.isTea !== undefined &&
      updateAtendimentoDto.isTea !== atendimentoAtual.isTea;

    if (mudouTipoPaciente && updateAtendimentoDto.pacienteId === undefined) {
      throw new BadRequestException(
        'Informe o novo paciente ao alterar o tipo de paciente.',
      );
    }

    const atendimentoAtualizado: CreateAtendimentoDto = {
      pacienteId:
        updateAtendimentoDto.pacienteId ?? atendimentoAtual.pacienteId,
      isTea: updateAtendimentoDto.isTea ?? atendimentoAtual.isTea,
      profissionalId:
        updateAtendimentoDto.profissionalId ?? atendimentoAtual.profissionalId,
      dataInicio:
        updateAtendimentoDto.dataInicio ?? atendimentoAtual.dataInicio,
      tipo: updateAtendimentoDto.tipo ?? atendimentoAtual.tipo,
    };

    const mudouPaciente =
      String(atendimentoAtualizado.pacienteId) !==
        String(atendimentoAtual.pacienteId) ||
      atendimentoAtualizado.isTea !== atendimentoAtual.isTea;

    // Revalida sempre que muda o horário, o profissional ou o paciente
    const mudouAgendamento =
      mudouPaciente ||
      atendimentoAtualizado.dataInicio.getTime() !==
        new Date(atendimentoAtual.dataInicio).getTime() ||
      atendimentoAtualizado.profissionalId !== atendimentoAtual.profissionalId;

    if (mudouAgendamento) {
      await this.validateTimes(atendimentoAtualizado, id);
    }

    if (!mudouPaciente) {
      return this.atendimentosRepository.update(id, atendimentoAtualizado);
    }

    // O novo paciente do atendimento sai da lista de espera na mesma transação
    return this.atendimentosRepository.emTransacao(async (client) => {
      const result = await this.atendimentosRepository.update(
        id,
        atendimentoAtualizado,
        client,
      );
      if (result) {
        await this.listaEsperaService.retirarPorAgendamento(
          this.pacienteRef(atendimentoAtualizado),
          client,
        );
      }
      return result;
    });
  }

  async remove(id: string) {
    const removed = await this.atendimentosRepository.remove(id);

    if (!removed) {
      throw new NotFoundException(`Atendimento com id ${id} não encontrado.`);
    }
  }

  private pacienteRef(dto: CreateAtendimentoDto): PacienteRef {
    return {
      tipo: dto.isTea ? TipoPaciente.TEA : TipoPaciente.BENEFICIARIO,
      id: dto.pacienteId,
    };
  }

  // atendimentoId é informado na atualização, para o atendimento não conflitar com ele mesmo
  private async validateTimes(
    dto: CreateAtendimentoDto,
    atendimentoId?: string,
  ): Promise<void> {
    if (dto.dataInicio.getTime() < Date.now()) {
      throw new BadRequestException(
        'O horário solicitado corresponde a uma data passada.',
      );
    }

    const profissional = await this.profissionaisService.findOne(
      dto.profissionalId,
    );

    if (profissional.ativo === false) {
      throw new BadRequestException('O profissional informado está inativo.');
    }

    if (!profissional.horario_inicio || !profissional.horario_fim) {
      throw new BadRequestException(
        'O profissional não possui horário de atendimento cadastrado.',
      );
    }

    if (
      !(await this.atendimentosRepository.isPacienteAtivo(
        dto.pacienteId,
        dto.isTea,
      ))
    ) {
      throw new NotFoundException('Paciente não encontrado ou inativo.');
    }

    if (
      await this.atendimentosRepository.hasTimeConflict(
        dto.profissionalId,
        dto.dataInicio,
        'profissional',
        atendimentoId,
      )
    ) {
      throw new ConflictException(
        'O horário solicitado conflita com o de um atendimento já marcado para este profissional.',
      );
    }

    if (
      await this.atendimentosRepository.hasTimeConflict(
        dto.pacienteId,
        dto.dataInicio,
        dto.isTea ? 'paciente_tea' : 'paciente',
        atendimentoId,
      )
    ) {
      throw new ConflictException(
        'O horário solicitado conflita com o de um atendimento já marcado para este paciente.',
      );
    }

    if (
      !this.verifyAvailability(
        profissional.horario_inicio,
        profissional.horario_fim,
        dto.dataInicio,
      )
    ) {
      throw new ConflictException(
        'O horário solicitado está fora da disponibilidade do profissional.',
      );
    }
  }

  private verifyAvailability(
    horarioInicio: string,
    horarioFim: string,
    dataInicio: Date,
  ): boolean {
    const timeZone = 'America/Recife';

    // Converte inicioAtendimento e fimAtendimento em minutos
    const minutosDoDia = (date: Date): number => {
      const [hora, minutos] = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .format(date)
        .split(':')
        .map(Number);

      return hora * 60 + minutos;
    };

    // Converte horario_inicio e horario_fim em minutos
    const horarioEmMinutos = (horario: string): number => {
      const [hora, minutos] = horario.split(':').map(Number);
      return hora * 60 + minutos;
    };

    const inicioAtendimento = minutosDoDia(dataInicio);
    const fimAtendimento = minutosDoDia(
      new Date(dataInicio.getTime() + 20 * 60000),
    );

    return (
      inicioAtendimento >= horarioEmMinutos(horarioInicio) &&
      fimAtendimento <= horarioEmMinutos(horarioFim)
    );
  }
}

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

@Injectable()
export class AtendimentosService {
  constructor(
    private readonly atendimentosRepository: AtendimentosRepository,
    private readonly profissionaisService: ProfissionaisService,
  ) {}

  async create(createAtendimentoDto: CreateAtendimentoDto) {
    await this.validateTimes(createAtendimentoDto);
    return this.atendimentosRepository.create(createAtendimentoDto);
  }

  findAll() {
    return this.atendimentosRepository.findAll();
  }

  async findOne(id: number) {
    const atendimento = await this.atendimentosRepository.findOne(id);
    if (!atendimento) {
      throw new NotFoundException(`Atendimento com id ${id} não encontrado.`);
    }
    return atendimento;
  }

  async update(id: number, updateAtendimentoDto: UpdateAtendimentoDto) {
    if (Object.keys(updateAtendimentoDto).length === 0) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
      );
    }

    const atendimentoAtual = await this.atendimentosRepository.findOne(id);
    if (!atendimentoAtual) {
      throw new NotFoundException(`Atendimento com id ${id} não encontrado.`);
    }

    const atendimentoAtualizado = {
      ...atendimentoAtual,
      ...updateAtendimentoDto,
    };
    if (atendimentoAtual.dataInicio !== atendimentoAtualizado.dataInicio) {
      await this.validateTimes(atendimentoAtualizado);
    }

    const result = await this.atendimentosRepository.update(
      id,
      atendimentoAtualizado,
    );
    return result;
  }

  async remove(id: number) {
    const removed = await this.atendimentosRepository.remove(id);

    if (!removed) {
      throw new NotFoundException(`Atendimento com id ${id} não encontrado.`);
    }
  }

  private async validateTimes(dto: CreateAtendimentoDto): Promise<void> {
    if (!(await this.verifyAvailability(dto.profissionalId, dto.dataInicio))) {
      throw new ConflictException(
        'O horário solicitado está fora da disponibilidade do profissional.',
      );
    }

    if (
      await this.atendimentosRepository.hasTimeConflict(
        dto.profissionalId,
        dto.dataInicio,
        'profissional',
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
        'paciente',
      )
    ) {
      throw new ConflictException(
        'O horário solicitado conflita com o de um atendimento já marcado para este paciente.',
      );
    }
  }

  private async verifyAvailability(
    idProfissional: string,
    dataInicio: Date,
  ): Promise<boolean> {
    const timeZone = 'America/Recife';
    const profissional =
      await this.profissionaisService.findOne(idProfissional);
    const { horario_inicio, horario_fim } = profissional;

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

    const horarioProfInicio = horarioEmMinutos(horario_inicio);
    const horarioProfFim = horarioEmMinutos(horario_fim);

    return (inicioAtendimento >= horarioProfInicio && fimAtendimento <= horarioProfFim);
  }
}

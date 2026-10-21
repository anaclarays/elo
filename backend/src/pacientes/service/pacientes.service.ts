import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBeneficiarioDto } from '../dto/create-paciente.dto';
import { PacientesRepository } from '../pacientes.repository';

@Injectable()
export class PacientesService {
  constructor(private readonly pacientesRepository: PacientesRepository) {}

  async create(createPacienteDto: CreateBeneficiarioDto) {
    this.validateConditionalFields(createPacienteDto);
    return this.pacientesRepository.create({
      ...createPacienteDto,
      dataCadastro: new Date().toISOString(),
    });
  }

  async findAll() {
    return this.pacientesRepository.findAll();
  }

  async findOne(id: number) {
    this.validateId(id);
    const paciente = await this.pacientesRepository.findOne(id);

    if (!paciente) {
      throw new NotFoundException(`Paciente com id ${id} não encontrado.`);
    }

    return paciente;
  }

  async update(id: number, updatePacienteDto: Partial<CreateBeneficiarioDto>) {
    this.validateId(id);

    if (Object.keys(updatePacienteDto).length === 0) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar.',
      );
    }

    const currentPaciente = await this.pacientesRepository.findOne(id);

    if (!currentPaciente) {
      throw new NotFoundException(`Paciente com id ${id} não encontrado.`);
    }

    const normalizedUpdate: Partial<CreateBeneficiarioDto> = {
      ...updatePacienteDto,
    };

    if (normalizedUpdate.possuiIrmaos === false) {
      normalizedUpdate.quantidadeIrmaos = null as any;
      normalizedUpdate.nomesIrmaos = null as any;
    }

    if (normalizedUpdate.possuiDeficit === false) {
      normalizedUpdate.queixa = null as any;
    }

    if (normalizedUpdate.fazAcompanhamento === false) {
      normalizedUpdate.quaisAcompanhamentos = null as any;
    }

    if (normalizedUpdate.fazUsoMedicacao === false) {
      normalizedUpdate.quaisMedicacoes = null as any;
    }

    const pacienteAtualizado = { ...currentPaciente, ...normalizedUpdate };
    this.validateConditionalFields(pacienteAtualizado);

    const paciente = await this.pacientesRepository.update(id, normalizedUpdate);

    if (!paciente) {
      throw new NotFoundException(`Paciente com id ${id} não encontrado.`);
    }

    return paciente;
  }

  async remove(id: number) {
    this.validateId(id);
    const removed = await this.pacientesRepository.remove(id);

    if (!removed) {
      throw new NotFoundException(`Paciente com id ${id} não encontrado.`);
    }
  }

  private validateId(id: number) {
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException(
        'O id do paciente deve ser um inteiro positivo.',
      );
    }
  }

  private validateConditionalFields(
    paciente: Pick<
      CreateBeneficiarioDto,
      | 'possuiIrmaos'
      | 'quantidadeIrmaos'
      | 'nomesIrmaos'
      | 'possuiDeficit'
      | 'queixa'
      | 'fazAcompanhamento'
      | 'quaisAcompanhamentos'
      | 'fazUsoMedicacao'
      | 'quaisMedicacoes'
    >,
  ) {
    if (
      paciente.possuiIrmaos &&
      (!paciente.quantidadeIrmaos || !paciente.nomesIrmaos?.trim())
    ) {
      throw new BadRequestException(
        'Informe a quantidade e os nomes dos irmãos quando o paciente possuir irmãos.',
      );
    }

    if (paciente.possuiDeficit && !paciente.queixa) {
      throw new BadRequestException(
        'Informe a queixa de aprendizado quando o paciente possuir déficit ou transtorno.',
      );
    }

    if (paciente.fazAcompanhamento && !paciente.quaisAcompanhamentos?.trim()) {
      throw new BadRequestException(
        'Informe os acompanhamentos terapêuticos realizados.',
      );
    }

    if (paciente.fazUsoMedicacao && !paciente.quaisMedicacoes?.trim()) {
      throw new BadRequestException('Informe as medicações utilizadas.');
    }
  }
}

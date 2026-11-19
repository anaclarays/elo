import {
  IsEnum,
  IsNotEmpty,
  isUUID,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { TipoPaciente } from '../enum/lista-espera.enum';

// Paciente comum tem id inteiro; paciente TEA tem id UUID
@ValidatorConstraint({ name: 'pacienteIdPorTipo', async: false })
class PacienteIdPorTipoConstraint implements ValidatorConstraintInterface {
  validate(valor: unknown, args: ValidationArguments): boolean {
    const { tipoPaciente } = args.object as { tipoPaciente?: TipoPaciente };

    if (tipoPaciente === TipoPaciente.TEA) {
      return typeof valor === 'string' && isUUID(valor);
    }
    if (tipoPaciente === TipoPaciente.BENEFICIARIO) {
      return typeof valor === 'number' && Number.isInteger(valor) && valor > 0;
    }
    return false;
  }

  defaultMessage(): string {
    return 'pacienteId deve ser um inteiro positivo (beneficiario) ou um UUID (tea)';
  }
}

// RN29: depois de sair da lista, o paciente só volta se for incluído manualmente
export class AdicionarListaEsperaDto {
  @IsEnum(TipoPaciente)
  tipoPaciente: TipoPaciente;

  @IsNotEmpty()
  @Validate(PacienteIdPorTipoConstraint)
  pacienteId: number | string;
}

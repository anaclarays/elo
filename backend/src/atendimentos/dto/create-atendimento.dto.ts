import { Transform } from 'class-transformer';
import {
  isUUID,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsUUID,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export enum TipoAtendimento {
  PSICOLOGIA = 'psicologia',
  TERAPIA_OCUPACIONAL = 'terapia ocupacional',
  PEDAGOGIA = 'pedagogia',
}

export enum StatusAtendimento {
  AGENDADO = 'agendado',
  CANCELADO = 'cancelado',
}

@ValidatorConstraint({ name: 'pacienteIdPorTipo', async: false })
class PacienteIdPorTipoConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const { isTea } = args.object as { isTea?: boolean };

    // Paciente TEA usa UUID; paciente comum usa id inteiro
    if (isTea === true) {
      return typeof value === 'string' && isUUID(value);
    }

    return (
      isTea === false &&
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value > 0
    );
  }

  defaultMessage(args: ValidationArguments): string {
    const { isTea } = args.object as { isTea?: boolean };
    return isTea
      ? 'pacienteId deve ser o UUID de um paciente TEA'
      : 'pacienteId deve ser o id inteiro de um paciente';
  }
}

// Data e hora em ISO 8601 com fuso (ex.: 2026-11-25T10:00:00-03:00)
const DATA_HORA_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export class CreateAtendimentoDto {
  @IsNotEmpty()
  @Validate(PacienteIdPorTipoConstraint)
  pacienteId: number | string;

  @IsUUID('all', { message: 'profissionalId deve ser um UUID válido' })
  profissionalId: string;

  // O JSON envia a data como texto: converte para Date só se vier com data, hora e fuso
  @Transform(({ value }) =>
    typeof value === 'string' && DATA_HORA_ISO.test(value)
      ? new Date(value)
      : value,
  )
  @IsDate({
    message:
      'dataInicio deve ter data, hora e fuso (ex.: 2026-11-25T10:00:00-03:00)',
  })
  dataInicio: Date;

  @IsNotEmpty()
  @IsEnum(TipoAtendimento)
  tipo: TipoAtendimento;

  @IsNotEmpty()
  @IsBoolean()
  isTea: boolean;
}

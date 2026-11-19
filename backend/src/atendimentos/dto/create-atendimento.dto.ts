import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsString,
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

@ValidatorConstraint({ name: 'pacienteIdPorTipo', async: false })
class PacienteIdPorTipoConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const { isTea } = args.object as { isTea?: boolean };

    if (isTea === true) {
      return typeof value === 'string' && value.trim().length > 0;
    }

    return (
      isTea === false &&
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value > 0
    );
  }
}

export class CreateAtendimentoDto {
  @IsNotEmpty()
  @Validate(PacienteIdPorTipoConstraint)
  pacienteId: number | string;

  @IsNotEmpty()
  @IsString()
  profissionalId: string;

  @IsNotEmpty()
  @IsDate()
  dataInicio: Date;

  @IsNotEmpty()
  @IsEnum(TipoAtendimento)
  tipo: TipoAtendimento;

  @IsNotEmpty()
  @IsBoolean()
  isTea: boolean;
}

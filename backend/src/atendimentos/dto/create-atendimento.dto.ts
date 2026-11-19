import { IsDate, IsEnum, IsInt, IsNotEmpty, IsString } from "class-validator";

export enum TipoAtendimento {
  PSICOLOGIA = 'psicologia',
  TERAPIA_OCUPACIONAL = 'terapia ocupacional',
  PEDAGOGIA = 'pedagogia',
}

export class CreateAtendimentoDto {
    @IsNotEmpty()
    @IsInt()
    pacienteId: number

    @IsNotEmpty()
    @IsString()
    profissionalId: string

    @IsNotEmpty()
    @IsDate()
    dataInicio: Date

    @IsNotEmpty()
    @IsEnum(TipoAtendimento)
    tipo: TipoAtendimento
}

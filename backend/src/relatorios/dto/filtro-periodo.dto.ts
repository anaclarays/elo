import { IsISO8601, IsOptional, Matches } from 'class-validator';

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MENSAGEM = (campo: string) =>
  `${campo} deve ser uma data válida no formato AAAA-MM-DD`;

export class FiltroPeriodoDto {
  @IsOptional()
  @Matches(DIA, { message: MENSAGEM('dataInicio') })
  @IsISO8601({ strict: true }, { message: MENSAGEM('dataInicio') })
  dataInicio?: string;

  @IsOptional()
  @Matches(DIA, { message: MENSAGEM('dataFim') })
  @IsISO8601({ strict: true }, { message: MENSAGEM('dataFim') })
  dataFim?: string;
}

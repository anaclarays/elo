import { applyDecorators } from '@nestjs/common';
import { IsEnum, IsISO8601, IsOptional, Matches } from 'class-validator';
import { TipoRegistroClinico } from '../enum/historico-clinico.enum';

// Data no formato AAAA-MM-DD e que exista de verdade no calendário
function IsDataIso(campo: string) {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: `${campo} deve estar no formato AAAA-MM-DD`,
    }),
    IsISO8601({ strict: true }, { message: `${campo} inválida` }),
  );
}

export class FiltrosHistoricoDto {
  @IsOptional()
  @IsDataIso('dataInicio')
  dataInicio?: string;

  @IsOptional()
  @IsDataIso('dataFim')
  dataFim?: string;

  @IsOptional()
  @IsEnum(TipoRegistroClinico, {
    message: 'tipo deve ser: atendimento, avaliacao, procedimento ou evolucao',
  })
  tipo?: TipoRegistroClinico;
}

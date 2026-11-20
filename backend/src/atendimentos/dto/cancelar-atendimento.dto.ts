import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelarAtendimentoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'motivo deve ter no máximo 500 caracteres' })
  motivo?: string;
}

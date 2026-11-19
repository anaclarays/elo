import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// RN33: a retirada manual exige uma justificativa
export class RetirarListaEsperaDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Informe a justificativa da retirada' })
  @MaxLength(1000)
  justificativa: string;
}

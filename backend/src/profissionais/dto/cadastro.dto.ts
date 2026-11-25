import { PickType, PartialType, IntersectionType } from '@nestjs/mapped-types';
import { Equals, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CreateProfissionalDto } from './create-profissional.dto';

export class CadastroDto extends IntersectionType(
  PickType(CreateProfissionalDto, ['nomeCompleto', 'cpf', 'email', 'areaAtuacao', 'senha'] as const),
  PartialType(PickType(CreateProfissionalDto, [
    'telefone', 'cargo', 'periodos', 'horarioInicio', 'horarioFim', 'status',
  ] as const)),
) {
  @Equals(true, { message: 'Confirme a autorização de tratamento de dados' })
  consentimentoLgpd: boolean;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'A capacidade semanal deve ser maior ou igual a zero' })
  @Max(2147483647, { message: 'A capacidade semanal excede o limite permitido' })
  capacidadeSemanal?: number;
}

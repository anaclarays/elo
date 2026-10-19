import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateProfissionalDto } from './create-profissional.dto';

// Na atualização, a senha não é obrigatória nem editada por esse endpoint
// idealmente teria um endpoint separado de "trocar senha"
export class UpdateProfissionalDto extends PartialType(
  OmitType(CreateProfissionalDto, ['senha'] as const),
) {}
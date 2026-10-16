import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsOptional,
  IsInt,
  Matches,
  MinLength,
} from 'class-validator';
import { IsCpf } from '../validators/cpf.validator';

export enum AreaAtuacao {
  COORDENACAO_ADMINISTRATIVA = 'coordenacao_administrativa',
  VOLUNTARIADO_SAUDE = 'voluntariado_saude',
  VOLUNTARIADO_EDUCACAO = 'voluntariado_educacao',
}

export class CreateProfissionalDto {
  @IsString()
  @IsNotEmpty()
  nomeCompleto: string;

  @IsCpf({ message: 'CPF inválido' })
  cpf: string;

  @IsString()
  @IsNotEmpty()
  telefone: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @IsEnum(AreaAtuacao, { message: 'Área de atuação inválida' })
  areaAtuacao: AreaAtuacao;

  @IsString()
  @IsNotEmpty()
  cargo: string;

  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  @Matches(/(?=.*[A-Z])/, { message: 'A senha deve ter ao menos uma letra maiúscula' })
  @Matches(/(?=.*[a-z])/, { message: 'A senha deve ter ao menos uma letra minúscula' })
  @Matches(/(?=.*\d)/, { message: 'A senha deve ter ao menos um número' })
  @Matches(/(?=.*[^A-Za-z0-9])/, { message: 'A senha deve ter ao menos um caractere especial' })
  senha: string;

  // Campos opcionais, só fazem sentido quando areaAtuacao é voluntariado
  @IsOptional()
  @IsInt()
  capacidadeSemanal?: number;

  @IsOptional()
  @IsString()
  horarioAtendimento?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  telefoneAtendimento?: string;
}
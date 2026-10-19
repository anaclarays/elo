import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsOptional,
  IsInt,
  Matches,
  MinLength,
  IsArray,
} from 'class-validator';
import { IsCpf } from '../validators/cpf.validator';

export enum AreaAtuacao {
  COORDENACAO_ADMINISTRATIVA = 'coordenacao_administrativa',
  VOLUNTARIADO_SAUDE = 'voluntariado_saude',
  VOLUNTARIADO_EDUCACAO = 'voluntariado_educacao',
};

export enum Periodo {
  MANHA = 'manha',
  TARDE = 'tarde',
  NOITE = 'noite',
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
  @IsArray()
  @IsEnum(Periodo, { each: true })
  periodos?: Periodo[];

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'horarioInicio deve estar no formato HH:mm' })
  horarioInicio?: string;

@IsOptional()
@Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'horarioFim deve estar no formato HH:mm' })
horarioFim?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  telefoneAtendimento?: string;
}
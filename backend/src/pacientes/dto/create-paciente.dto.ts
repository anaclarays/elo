import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsCpf } from '../../profissionais/validators/cpf.validator';

export enum QueixaAprendizado {
  MOTORA = 'motora',
  LEITURA = 'leitura',
  ESCRITA = 'escrita',
  LOGICA_MATEMATICA = 'lógica matemática',
}

export class CreateBeneficiarioDto {
  @IsNotEmpty()
  @IsString()
  numeroCadastro: string;

  @IsNotEmpty()
  @IsString()
  nomeBeneficiario: string;

  @IsNotEmpty()
  @IsDateString()
  dataNascimento: string;

  @IsNotEmpty()
  @IsString()
  rg: string;

  @IsCpf({ message: 'CPF inválido' })
  cpf: string;

  @IsNotEmpty()
  @IsString()
  nomeMae: string;

  @IsNotEmpty()
  @IsString()
  endereco: string;

  @IsNotEmpty()
  @IsString()
  numero: string;

  @IsNotEmpty()
  @IsString()
  bairro: string;

  @IsNotEmpty()
  @IsString()
  cidade: string;

  @IsNotEmpty()
  @IsString()
  cep: string;

  @IsNotEmpty()
  @IsString()
  estado: string;

  @IsNotEmpty()
  @IsString()
  contato: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsBoolean()
  possuiIrmaos: boolean;

  @IsNotEmpty()
  @IsString()
  escolaFrequenta: string;

  @IsNotEmpty()
  @IsString()
  serie: string;

  @IsNotEmpty()
  @IsBoolean()
  possuiDeficit: boolean;

  @IsNotEmpty()
  @IsBoolean()
  fazAcompanhamento: boolean;

  @IsNotEmpty()
  @IsBoolean()
  fazUsoMedicacao: boolean;

  @ValidateIf((paciente) => paciente.possuiIrmaos === true)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantidadeIrmaos?: number;

  @ValidateIf((paciente) => paciente.possuiIrmaos === true)
  @IsNotEmpty()
  @IsString()
  nomesIrmaos?: string;

  @ValidateIf((paciente) => paciente.possuiDeficit === true)
  @IsNotEmpty()
  @IsEnum(QueixaAprendizado)
  queixa?: QueixaAprendizado;

  @ValidateIf((paciente) => paciente.fazAcompanhamento === true)
  @IsNotEmpty()
  @IsString()
  quaisAcompanhamentos?: string;

  @ValidateIf((paciente) => paciente.fazUsoMedicacao === true)
  @IsNotEmpty()
  @IsString()
  quaisMedicacoes?: string;

  @IsOptional()
  @IsString()
  nomePai?: string;

  @IsOptional()
  @IsString()
  acompanhanteEscolar?: string;
}

export class UpdateBeneficiarioDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  numeroCadastro?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  nomeBeneficiario?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  rg?: string;

  @IsOptional()
  @IsCpf({ message: 'CPF inválido' })
  cpf?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  nomeMae?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  contato?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  possuiIrmaos?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeIrmaos?: number;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  nomesIrmaos?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  escolaFrequenta?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  serie?: string;

  @IsOptional()
  @IsBoolean()
  possuiDeficit?: boolean;

  @IsOptional()
  @IsEnum(QueixaAprendizado)
  queixa?: QueixaAprendizado;

  @IsOptional()
  @IsBoolean()
  fazAcompanhamento?: boolean;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  quaisAcompanhamentos?: string;

  @IsOptional()
  @IsBoolean()
  fazUsoMedicacao?: boolean;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  quaisMedicacoes?: string;

  @IsOptional()
  @IsString()
  nomePai?: string;

  @IsOptional()
  @IsString()
  acompanhanteEscolar?: string;
}

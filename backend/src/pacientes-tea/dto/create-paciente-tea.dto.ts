import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsCpf } from '../../profissionais/validators/cpf.validator';
import {
  CATEGORIAS_COM_RESPONSAVEL,
  CategoriaEtaria,
  EstadoCivil,
  Genero,
  Terapia,
} from '../enum/pacientes-tea.enum';

// Data no formato AAAA-MM-DD e que exista de verdade no calendário 
function IsDataIso(campo: string) {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: `${campo} deve estar no formato AAAA-MM-DD` }),
    IsISO8601({ strict: true }, { message: `${campo} inválida` }),
  );
}

export class ResponsavelLegalDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @IsNotEmpty()
  rg: string;

  @IsCpf({ message: 'CPF do responsável inválido' })
  cpf: string;

  @IsDataIso('dataNascimento do responsável')
  dataNascimento: string;
}

export class DadosFamiliaresDto {
  @IsEnum(EstadoCivil, { message: 'estadoCivil inválido' })
  estadoCivil: EstadoCivil;

  @IsString()
  @IsNotEmpty()
  endereco: string;

  @IsString()
  @IsNotEmpty()
  numero: string;

  @IsString()
  @IsNotEmpty()
  bairro: string;

  @IsString()
  @IsNotEmpty()
  cidade: string;

  @Matches(/^[A-Z]{2}$/, { message: 'estado deve ser a sigla da UF em maiúsculas (ex.: PE)' })
  estado: string;

  @IsString()
  @IsNotEmpty()
  contato: string;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string;

  @IsOptional()
  @IsString()
  nomeConjuge?: string;

  @IsBoolean()
  possuiFilhos: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtdMeninas?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtdMeninos?: number;

  @IsInt()
  @Min(1)
  numPessoasCasa: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rendaFamiliar?: number;

  @IsOptional()
  @IsBoolean()
  recebeBolsaFamilia?: boolean;

  @IsOptional()
  @IsBoolean()
  recebeOutroBeneficio?: boolean;
}

export class CreatePacienteTeaDto {
  @IsEnum(CategoriaEtaria, { message: 'categoria deve ser: crianca, adolescente, adulto ou idoso' })
  categoria: CategoriaEtaria;

  @IsString()
  @IsNotEmpty()
  nomeCompleto: string;

  @IsDataIso('dataNascimento')
  dataNascimento: string;

  @IsString()
  @IsNotEmpty()
  rgOuCertidao: string;

  @IsCpf({ message: 'CPF inválido' })
  cpf: string;

  @IsEnum(Genero, { message: 'genero deve ser: masculino, feminino ou outros' })
  genero: Genero;

  @IsBoolean()
  frequentaEscola: boolean;

  @ValidateIf((o) => o.frequentaEscola === true)
  @IsString()
  @IsNotEmpty({ message: 'nomeInstituicao é obrigatório quando frequentaEscola é true' })
  nomeInstituicao?: string;

  @IsBoolean()
  aguardaDiagnostico: boolean;

  @IsBoolean()
  parecerEspecialista: boolean;

  @ValidateIf((o) => o.parecerEspecialista === true)
  @IsString()
  @IsNotEmpty({ message: 'parecerQuais é obrigatório quando parecerEspecialista é true' })
  parecerQuais?: string;

  @IsBoolean()
  laudoMedico: boolean;

  @IsInt()
  @Min(1, { message: 'nivelSuporte deve ser 1, 2 ou 3' })
  @Max(3, { message: 'nivelSuporte deve ser 1, 2 ou 3' })
  nivelSuporte: number;

  @IsOptional()
  @IsString()
  outrosDiagnosticos?: string;

  @IsBoolean()
  realizaTerapias: boolean;

  @ValidateIf((o) => o.realizaTerapias === true)
  @IsArray()
  @ArrayNotEmpty({ message: 'Informe ao menos uma terapia quando realizaTerapias é true' })
  @IsEnum(Terapia, { each: true, message: 'terapia inválida' })
  terapias?: Terapia[];

  @ValidateIf((o) => Array.isArray(o.terapias) && o.terapias.includes(Terapia.OUTROS))
  @IsString()
  @IsNotEmpty({ message: 'terapiaOutros é obrigatório quando a terapia "outros" é marcada' })
  terapiaOutros?: string;

  @IsOptional()
  @IsString()
  medicacoes?: string;

  @IsOptional()
  @IsString()
  alergias?: string;

  @IsBoolean()
  ciptea: boolean;

  @IsBoolean()
  bpc: boolean;

  @IsOptional()
  @Matches(/^\d{15}$/, { message: 'numeroCartaoSus deve ter 15 dígitos' })
  numeroCartaoSus?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsUUID('all', { message: 'responsavelTriagemId deve ser um UUID válido' })
  responsavelTriagemId: string;

  // Obrigatório só para criança/adolescente (para adulto/idoso é ignorado)
  @ValidateIf((o) => CATEGORIAS_COM_RESPONSAVEL.includes(o.categoria))
  @IsDefined({ message: 'responsavelLegal é obrigatório para criança/adolescente' })
  @ValidateNested()
  @Type(() => ResponsavelLegalDto)
  responsavelLegal?: ResponsavelLegalDto;

  @IsDefined({ message: 'dadosFamiliares é obrigatório' })
  @ValidateNested()
  @Type(() => DadosFamiliaresDto)
  dadosFamiliares: DadosFamiliaresDto;
}
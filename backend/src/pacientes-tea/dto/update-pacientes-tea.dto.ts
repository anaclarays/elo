import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsDefined, IsOptional, ValidateIf, ValidateNested } from 'class-validator';
import { CATEGORIAS_COM_RESPONSAVEL } from '../enum/pacientes-tea.enum';
import {
  CreatePacienteTeaDto,
  DadosFamiliaresDto,
  ResponsavelLegalDto,
} from './create-paciente-tea.dto';

export class UpdateDadosFamiliaresDto extends PartialType(DadosFamiliaresDto) {}

export class UpdatePacienteTeaDto extends PartialType(
  OmitType(CreatePacienteTeaDto, ['dadosFamiliares', 'responsavelLegal'] as const),
) {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateDadosFamiliaresDto)
  dadosFamiliares?: UpdateDadosFamiliaresDto;

  // Se mudar a categoria para criança/adolescente, o responsável legal precisa vir completo
  @ValidateIf(
    (o) => CATEGORIAS_COM_RESPONSAVEL.includes(o.categoria) || o.responsavelLegal !== undefined,
  )
  @IsDefined()
  @ValidateNested()
  @Type(() => ResponsavelLegalDto)
  responsavelLegal?: ResponsavelLegalDto;
}
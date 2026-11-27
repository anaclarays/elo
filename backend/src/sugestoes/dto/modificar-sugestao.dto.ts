import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TipoAtendimento } from '../../atendimentos/dto/create-atendimento.dto';

// Mesmo formato aceito em POST /atendimentos: data, hora e fuso
const DATA_HORA_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

// Ajustes feitos antes de aprovar; os campos aceitos dependem do tipo de sugestão
export class ModificarSugestaoDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Informe o motivo do ajuste' })
  @MaxLength(500)
  motivo: string;

  @IsOptional()
  @IsUUID('all', { message: 'profissionalId deve ser um UUID válido' })
  profissionalId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && DATA_HORA_ISO.test(value)
      ? new Date(value)
      : value,
  )
  @IsDate({
    message:
      'dataInicio deve ter data, hora e fuso (ex.: 2026-11-25T10:00:00-03:00)',
  })
  dataInicio?: Date;

  @IsOptional()
  @IsEnum(TipoAtendimento)
  tipo?: TipoAtendimento;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Escolha ao menos um atendimento para cancelar' })
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  atendimentoIds?: string[];
}

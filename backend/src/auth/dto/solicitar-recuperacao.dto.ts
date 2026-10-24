import { IsEmail } from 'class-validator';

export class SolicitarRecuperacaoDto {
  @IsEmail()
  email: string;
}

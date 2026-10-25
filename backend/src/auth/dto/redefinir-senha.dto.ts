import { IsString, Matches, MinLength } from 'class-validator';

export class RedefinirSenhaDto {
  @IsString()
  token: string;

  @MinLength(8)
  @Matches(/(?=.*[A-Z])/, {
    message: 'A senha deve ter ao menos uma letra maiúscula',
  })
  @Matches(/(?=.*[a-z])/, {
    message: 'A senha deve ter ao menos uma letra minúscula',
  })
  @Matches(/(?=.*\d)/, { message: 'A senha deve ter ao menos um número' })
  @Matches(/(?=.*[^A-Za-z0-9])/, {
    message: 'A senha deve ter ao menos um caractere especial',
  })
  senha: string;
}

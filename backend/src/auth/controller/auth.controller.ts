import { Body, Controller, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { AuthService } from '../service/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RedefinirSenhaDto } from '../dto/redefinir-senha.dto';
import { SolicitarRecuperacaoDto } from '../dto/solicitar-recuperacao.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('recuperacao-senha')
  @HttpCode(HttpStatus.OK)
  solicitarRecuperacao(@Body() dto: SolicitarRecuperacaoDto) {
    return this.authService.solicitarRecuperacao(dto);
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.OK)
  redefinirSenha(@Query('token') token: string, @Body() dto: RedefinirSenhaDto) {
    return this.authService.redefinirSenha(token, dto);
  }
}

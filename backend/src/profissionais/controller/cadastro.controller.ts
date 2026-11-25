import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from '../../auth/service/auth.service';
import { CadastroDto } from '../dto/cadastro.dto';
import { AreaAtuacao } from '../dto/create-profissional.dto';
import { ProfissionaisService } from '../service/profissionais.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class CadastroController {
  constructor(
    private readonly profissionais: ProfissionaisService,
    private readonly auth: AuthService,
  ) {}

  @Post('cadastro')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async cadastro(@Body() dto: CadastroDto) {
    const { nomeCompleto, cpf, email, areaAtuacao, cargo, senha } = dto;
    const voluntario = areaAtuacao !== AreaAtuacao.COORDENACAO_ADMINISTRATIVA;
    if (!nomeCompleto.trim()) throw new BadRequestException('Informe o nome completo');
    if (Buffer.byteLength(senha) > 72) throw new BadRequestException('Informe uma senha de até 72 bytes');
    if (voluntario && dto.horarioInicio && dto.horarioFim && dto.horarioInicio >= dto.horarioFim) {
      throw new BadRequestException('A hora de fim deve ser posterior à hora de início');
    }

    const perfil = await this.profissionais.create({
      nomeCompleto: nomeCompleto.trim(),
      cpf: cpf.replace(/\D/g, ''),
      email: email.trim().toLowerCase(),
      areaAtuacao,
      cargo: cargo?.trim() || undefined,
      senha,
      ...(voluntario && {
        telefone: dto.telefone,
        capacidadeSemanal: dto.capacidadeSemanal,
        periodos: dto.periodos,
        horarioInicio: dto.horarioInicio,
        horarioFim: dto.horarioFim,
        status: dto.status,
      }),
    }, true);
    return this.auth.criarSessao(perfil);
  }
}

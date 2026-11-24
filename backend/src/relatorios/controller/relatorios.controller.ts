import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FiltroPeriodoDto } from '../dto/filtro-periodo.dto';
import { CoordenacaoGuard } from '../guards/coordenacao.guard';
import { RelatoriosService } from '../service/relatorios.service';

@Controller('relatorios')
@UseGuards(JwtAuthGuard, CoordenacaoGuard)
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Get()
  geral(@Query() filtro: FiltroPeriodoDto) {
    return this.relatoriosService.geral(filtro);
  }

  @Get('pacientes')
  pacientes(@Query() filtro: FiltroPeriodoDto) {
    return this.relatoriosService.pacientes(filtro);
  }

  @Get('lista-espera')
  listaEspera(@Query() filtro: FiltroPeriodoDto) {
    return this.relatoriosService.listaEspera(filtro);
  }

  @Get('atendimentos')
  atendimentos(@Query() filtro: FiltroPeriodoDto) {
    return this.relatoriosService.atendimentos(filtro);
  }

  @Get('profissionais')
  profissionais(@Query() filtro: FiltroPeriodoDto) {
    return this.relatoriosService.profissionais(filtro);
  }
}

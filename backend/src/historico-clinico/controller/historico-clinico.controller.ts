import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FiltrosHistoricoDto } from '../dto/filtros-historico.dto';
import { HistoricoClinicoService } from '../service/historico-clinico.service';

@Controller('historico-clinico')
@UseGuards(JwtAuthGuard)
export class HistoricoClinicoController {
  constructor(
    private readonly historicoClinicoService: HistoricoClinicoService,
  ) {}

  // Histórico de um paciente do cadastro de aprendizagem (o id ta como inteiro)
  @Get('pacientes/:id')
  listarPorPaciente(
    @Param('id', ParseIntPipe) id: number,
    @Query() filtros: FiltrosHistoricoDto,
  ) {
    return this.historicoClinicoService.listarPorPaciente(id, filtros);
  }

  // Histórico de um paciente do cadastro de TEA (o id ta como uuid)
  @Get('pacientes-tea/:id')
  listarPorPacienteTea(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filtros: FiltrosHistoricoDto,
  ) {
    return this.historicoClinicoService.listarPorPacienteTea(id, filtros);
  }

  // Detalhes de um registro clínico
  @Get('registros/:id')
  buscarRegistro(@Param('id', ParseUUIDPipe) id: string) {
    return this.historicoClinicoService.buscarRegistro(id);
  }
}

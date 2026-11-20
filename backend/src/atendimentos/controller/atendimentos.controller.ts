import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AtendimentosService } from '../service/atendimentos.service';
import {
  CreateAtendimentoDto,
  StatusAtendimento,
} from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';
import { CancelarAtendimentoDto } from '../dto/cancelar-atendimento.dto';

@Controller('atendimentos')
@UseGuards(JwtAuthGuard)
export class AtendimentosController {
  constructor(private readonly atendimentosService: AtendimentosService) {}

  @Post()
  create(@Body() createAtendimentoDto: CreateAtendimentoDto) {
    return this.atendimentosService.create(createAtendimentoDto);
  }

  // ?status=agendado ou ?status=cancelado filtra a lista; sem filtro, traz todos
  @Get()
  findAll(
    @Query('status', new ParseEnumPipe(StatusAtendimento, { optional: true }))
    status?: StatusAtendimento,
  ) {
    return this.atendimentosService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.atendimentosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAtendimentoDto: UpdateAtendimentoDto,
  ) {
    return this.atendimentosService.update(id, updateAtendimentoDto);
  }

  // Cancela sem apagar, mantendo o histórico (substitui o antigo DELETE)
  @Patch(':id/cancelar')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cancelarAtendimentoDto: CancelarAtendimentoDto,
  ) {
    return this.atendimentosService.cancel(id, cancelarAtendimentoDto.motivo);
  }
}

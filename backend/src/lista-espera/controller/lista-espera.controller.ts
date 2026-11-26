import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CoordenacaoGuard } from '../../auth/guards/coordenacao.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdicionarListaEsperaDto } from '../dto/adicionar-lista-espera.dto';
import { RetirarListaEsperaDto } from '../dto/retirar-lista-espera.dto';
import { TipoPaciente } from '../enum/lista-espera.enum';
import { ListaEsperaService } from '../service/lista-espera.service';

type RequestAutenticado = Request & { user: { sub: string } };

@Controller('lista-espera')
@UseGuards(JwtAuthGuard)
export class ListaEsperaController {
  constructor(private readonly listaEsperaService: ListaEsperaService) {}

  @Get()
  consultar(
    @Query('tipo', new ParseEnumPipe(TipoPaciente, { optional: true }))
    tipo?: TipoPaciente,
    @Query('nome') nome?: string,
  ) {
    return this.listaEsperaService.consultar({ tipo, nome });
  }

  @Post()
  adicionar(@Body() dto: AdicionarListaEsperaDto) {
    return this.listaEsperaService.adicionarManualmente(dto);
  }

  // Só a coordenação pode retirar um paciente da fila manualmente
  @Patch(':id/retirar')
  @UseGuards(CoordenacaoGuard)
  retirar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RetirarListaEsperaDto,
    @Req() request: RequestAutenticado,
  ) {
    return this.listaEsperaService.retirarManualmente(
      id,
      dto.justificativa,
      request.user.sub,
    );
  }
}

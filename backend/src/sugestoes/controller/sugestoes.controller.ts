import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  PipeTransform,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CoordenacaoGuard } from '../../auth/guards/coordenacao.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { DescartarSugestaoDto } from '../dto/descartar-sugestao.dto';
import { SugestoesService } from '../service/sugestoes.service';

type RequestAutenticado = Request & { user: { sub: string } };

// O id da sugestão é um hash de 24 caracteres hexadecimais
export class IdSugestaoPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[0-9a-f]{24}$/.test(value)) {
      throw new BadRequestException('Id de sugestão inválido.');
    }
    return value;
  }
}

// Sugestões e decisões são só da coordenação
@Controller('sugestoes')
@UseGuards(JwtAuthGuard, CoordenacaoGuard)
export class SugestoesController {
  constructor(private readonly sugestoesService: SugestoesService) {}

  @Get()
  listar() {
    return this.sugestoesService.listar();
  }

  @Get('historico')
  historico() {
    return this.sugestoesService.historico();
  }

  @Post(':id/aprovar')
  @HttpCode(200)
  aprovar(
    @Param('id', IdSugestaoPipe) id: string,
    @Req() request: RequestAutenticado,
  ) {
    return this.sugestoesService.aprovar(id, request.user.sub);
  }

  @Post(':id/descartar')
  @HttpCode(200)
  descartar(
    @Param('id', IdSugestaoPipe) id: string,
    @Body() dto: DescartarSugestaoDto,
    @Req() request: RequestAutenticado,
  ) {
    return this.sugestoesService.descartar(id, dto.motivo, request.user.sub);
  }
}

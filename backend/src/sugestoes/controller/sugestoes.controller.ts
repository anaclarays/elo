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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AreaAtuacao } from '../../profissionais/dto/create-profissional.dto';
import { DescartarSugestaoDto } from '../dto/descartar-sugestao.dto';
import {
  SugestoesService,
  UsuarioSugestoes,
} from '../service/sugestoes.service';

type RequestAutenticado = Request & {
  user: { sub: string; areaAtuacao?: string };
};

const usuario = ({ user }: RequestAutenticado): UsuarioSugestoes => ({
  id: user.sub,
  coordenacao: user.areaAtuacao === AreaAtuacao.COORDENACAO_ADMINISTRATIVA,
});

// O id da sugestão é um hash de 24 caracteres hexadecimais
export class IdSugestaoPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^[0-9a-f]{24}$/.test(value)) {
      throw new BadRequestException('Id de sugestão inválido.');
    }
    return value;
  }
}

// Todos veem a aba; o service filtra o que cada perfil pode ver e decidir
@Controller('sugestoes')
@UseGuards(JwtAuthGuard)
export class SugestoesController {
  constructor(private readonly sugestoesService: SugestoesService) {}

  @Get()
  listar(@Req() request: RequestAutenticado) {
    return this.sugestoesService.listar(usuario(request));
  }

  @Get('historico')
  historico(@Req() request: RequestAutenticado) {
    return this.sugestoesService.historico(usuario(request));
  }

  @Post(':id/aprovar')
  @HttpCode(200)
  aprovar(
    @Param('id', IdSugestaoPipe) id: string,
    @Req() request: RequestAutenticado,
  ) {
    return this.sugestoesService.aprovar(id, usuario(request));
  }

  @Post(':id/descartar')
  @HttpCode(200)
  descartar(
    @Param('id', IdSugestaoPipe) id: string,
    @Body() dto: DescartarSugestaoDto,
    @Req() request: RequestAutenticado,
  ) {
    return this.sugestoesService.descartar(id, dto.motivo, usuario(request));
  }
}

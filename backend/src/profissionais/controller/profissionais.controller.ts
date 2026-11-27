import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CoordenacaoGuard } from '../../auth/guards/coordenacao.guard';
import { ProfissionaisService } from '../service/profissionais.service';
import { CreateProfissionalDto } from '../dto/create-profissional.dto';
import { UpdateProfissionalDto } from '../dto/update-profissional.dto';

@Controller('profissionais')
@UseGuards(JwtAuthGuard)
export class ProfissionaisController {
  constructor(private readonly profissionaisService: ProfissionaisService) {}

  @Get('meu-perfil')
  getMeuPerfil(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub;
    return this.profissionaisService.findOne(userId);
  }

  @Patch('meu-perfil')
  updateMeuPerfil(@Req() req: any, @Body() dto: UpdateProfissionalDto) {
    const userId = req.user?.id ?? req.user?.sub;
    return this.profissionaisService.update(userId, dto);
  }

  @Post()
  @UseGuards(CoordenacaoGuard)
  create(@Body() dto: CreateProfissionalDto) {
    return this.profissionaisService.create(dto);
  }

  @Get()
  @UseGuards(CoordenacaoGuard)
  findAll(@Query('cpf') cpf?: string, @Query('nome') nome?: string) {
    return this.profissionaisService.findAll({ cpf, nome });
  }

  @Get(':id')
  @UseGuards(CoordenacaoGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.profissionaisService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(CoordenacaoGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfissionalDto,
  ) {
    return this.profissionaisService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(CoordenacaoGuard)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.profissionaisService.remove(id);
  }
}
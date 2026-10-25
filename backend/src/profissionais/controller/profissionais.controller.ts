import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProfissionaisService } from '../service/profissionais.service';
import { CreateProfissionalDto } from '../dto/create-profissional.dto';
import { UpdateProfissionalDto } from '../dto/update-profissional.dto';

@Controller('profissionais')
export class ProfissionaisController {
  constructor(private readonly profissionaisService: ProfissionaisService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateProfissionalDto) {
    return this.profissionaisService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query('cpf') cpf?: string, @Query('nome') nome?: string) {
    return this.profissionaisService.findAll({ cpf, nome });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.profissionaisService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfissionalDto,
  ) {
    return this.profissionaisService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.profissionaisService.remove(id);
  }
}

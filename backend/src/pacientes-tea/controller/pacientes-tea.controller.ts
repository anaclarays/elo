import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreatePacienteTeaDto } from '../dto/create-paciente-tea.dto';
import { UpdatePacienteTeaDto } from '../dto/update-pacientes-tea.dto';
import { CategoriaEtaria } from '../enum/pacientes-tea.enum';
import { PacientesTeaService } from '../service/pacientes-tea.service';

@Controller('pacientes-tea')
@UseGuards(JwtAuthGuard)
export class PacientesTeaController {
  constructor(private readonly pacientesTeaService: PacientesTeaService) {}

  @Post()
  create(@Body() dto: CreatePacienteTeaDto) {
    return this.pacientesTeaService.create(dto);
  }

  @Get()
  findAll(
    @Query('cpf') cpf?: string,
    @Query('nome') nome?: string,
    @Query('numeroCadastro', new ParseIntPipe({ optional: true })) numeroCadastro?: number,
    @Query('categoria', new ParseEnumPipe(CategoriaEtaria, { optional: true }))
    categoria?: CategoriaEtaria,
  ) {
    return this.pacientesTeaService.findAll({ cpf, nome, numeroCadastro, categoria });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesTeaService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePacienteTeaDto) {
    return this.pacientesTeaService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.pacientesTeaService.remove(id);
  }
}
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CreateBeneficiarioDto,
  UpdateBeneficiarioDto,
} from '../dto/create-paciente.dto';
import { PacientesService } from '../service/pacientes.service';

@Controller('pacientes')
export class PacientesController {
  constructor(private readonly pacientesService: PacientesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createPacienteDto: CreateBeneficiarioDto) {
    return this.pacientesService.create(createPacienteDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.pacientesService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pacientesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePacienteDto: UpdateBeneficiarioDto,
  ) {
    return this.pacientesService.update(id, updatePacienteDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  replace(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePacienteDto: UpdateBeneficiarioDto,
  ) {
    return this.pacientesService.update(id, updatePacienteDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pacientesService.remove(id);
  }
}

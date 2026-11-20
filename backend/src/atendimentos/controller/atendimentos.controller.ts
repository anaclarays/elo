import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AtendimentosService } from '../service/atendimentos.service';
import { CreateAtendimentoDto } from '../dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from '../dto/update-atendimento.dto';

@Controller('atendimentos')
@UseGuards(JwtAuthGuard)
export class AtendimentosController {
  constructor(private readonly atendimentosService: AtendimentosService) {}

  @Post()
  create(@Body() createAtendimentoDto: CreateAtendimentoDto) {
    return this.atendimentosService.create(createAtendimentoDto);
  }

  @Get()
  findAll() {
    return this.atendimentosService.findAll();
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

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.atendimentosService.remove(id);
  }
}

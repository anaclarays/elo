import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PacientesController } from './pacientes.controller';
import { PacientesRepository } from './pacientes.repository';
import { PacientesService } from './pacientes.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PacientesController],
  providers: [PacientesService, PacientesRepository],
})
export class PacientesModule {}

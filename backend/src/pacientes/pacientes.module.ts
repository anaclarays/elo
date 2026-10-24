import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PacientesController } from './controller/pacientes.controller';
import { PacientesRepository } from './pacientes.repository';
import { PacientesService } from './service/pacientes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PacientesController],
  providers: [PacientesService, PacientesRepository],
})
export class PacientesModule {}

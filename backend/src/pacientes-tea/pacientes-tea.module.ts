import { Module } from '@nestjs/common';
import { PacientesTeaController } from './controller/pacientes-tea.controller';
import { PacientesTeaService } from './service/pacientes-tea.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  controllers: [PacientesTeaController],
  providers: [PacientesTeaService],
  imports: [AuthModule],
})
export class PacientesTeaModule {}
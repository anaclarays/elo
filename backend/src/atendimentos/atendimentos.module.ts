import { Module } from '@nestjs/common';
import { AtendimentosService } from './service/atendimentos.service';
import { AtendimentosController } from './controller/atendimentos.controller';
import { AtendimentosRepository } from './atendimentos.repository';
import { ProfissionaisService } from '../profissionais/service/profissionais.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AtendimentosController],
  providers: [
    AtendimentosService,
    AtendimentosRepository,
    ProfissionaisService,
  ],
})
export class AtendimentosModule {}

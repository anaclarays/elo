import { Module } from '@nestjs/common';
import { AtendimentosService } from './service/atendimentos.service';
import { AtendimentosController } from './controller/atendimentos.controller';
import { AtendimentosRepository } from './atendimentos.repository';
import { ProfissionaisService } from '../profissionais/service/profissionais.service';
import { AuthModule } from '../auth/auth.module';
import { ListaEsperaModule } from '../lista-espera/lista-espera.module';

@Module({
  imports: [AuthModule, ListaEsperaModule],
  controllers: [AtendimentosController],
  providers: [
    AtendimentosService,
    AtendimentosRepository,
    ProfissionaisService,
  ],
  exports: [AtendimentosService],
})
export class AtendimentosModule {}

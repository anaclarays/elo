import { Module } from '@nestjs/common';
import { AtendimentosModule } from '../atendimentos/atendimentos.module';
import { AuthModule } from '../auth/auth.module';
import { ListaEsperaModule } from '../lista-espera/lista-espera.module';
import { SugestoesController } from './controller/sugestoes.controller';
import { SugestoesService } from './service/sugestoes.service';
import { SugestoesRepository } from './sugestoes.repository';

@Module({
  imports: [AuthModule, AtendimentosModule, ListaEsperaModule],
  controllers: [SugestoesController],
  providers: [SugestoesService, SugestoesRepository],
})
export class SugestoesModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { PacientesModule } from './pacientes/pacientes.module';
import { ProfissionaisModule } from './profissionais/profissionais.module';
import { PacientesTeaModule } from './pacientes-tea/pacientes-tea.module';
import { AuthModule } from './auth/auth.module';
import { HistoricoClinicoModule } from './historico-clinico/historico-clinico.module';
import { ListaEsperaModule } from './lista-espera/lista-espera.module';
import { AtendimentosModule } from './atendimentos/atendimentos.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { SugestoesModule } from './sugestoes/sugestoes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    PacientesModule,
    ProfissionaisModule,
    PacientesTeaModule,
    HistoricoClinicoModule,
    AuthModule,
    ListaEsperaModule,
    AtendimentosModule,
    RelatoriosModule,
    SugestoesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { PacientesModule } from './pacientes/pacientes.module';
import { ProfissionaisModule } from './profissionais/profissionais.module';
import { PacientesTeaModule } from './pacientes-tea/pacientes-tea.module';
import { AuthModule } from './auth/auth.module';
import { ListaEsperaModule } from './lista-espera/lista-espera.module';
import { AtendimentosModule } from './atendimentos/atendimentos.module';
import { RelatoriosModule } from './relatorios/relatorios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    PacientesModule,
    ProfissionaisModule,
    PacientesTeaModule,
    AuthModule,
    ListaEsperaModule,
    AtendimentosModule,
    RelatoriosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { PacientesModule } from './pacientes/pacientes.module';
import { ProfissionaisModule } from './profissionais/profissionais.module';
import { AuthModule } from './auth/auth.module';
import { AtendimentosModule } from './atendimentos/atendimentos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    PacientesModule,
    ProfissionaisModule,
    AuthModule,
    AtendimentosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

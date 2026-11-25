import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HistoricoClinicoController } from './controller/historico-clinico.controller';
import { HistoricoClinicoService } from './service/historico-clinico.service';

@Module({
  imports: [AuthModule],
  controllers: [HistoricoClinicoController],
  providers: [HistoricoClinicoService],
})
export class HistoricoClinicoModule {}

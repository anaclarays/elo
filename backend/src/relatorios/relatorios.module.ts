import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RelatoriosController } from './controller/relatorios.controller';
import { CoordenacaoGuard } from './guards/coordenacao.guard';
import { RelatoriosRepository } from './relatorios.repository';
import { RelatoriosService } from './service/relatorios.service';

@Module({
  imports: [AuthModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService, RelatoriosRepository, CoordenacaoGuard],
})
export class RelatoriosModule {}

import { Module } from '@nestjs/common';
import { ProfissionaisController } from './controller/profissionais.controller';
import { ProfissionaisService } from './service/profissionais.service';
import { AuthModule } from '../auth/auth.module';
import { CadastroController } from './controller/cadastro.controller';
import { CoordenacaoGuard } from '../auth/guards/coordenacao.guard';

@Module({
  imports: [AuthModule],
  controllers: [ProfissionaisController, CadastroController],
  providers: [ProfissionaisService, CoordenacaoGuard],
})
export class ProfissionaisModule {}

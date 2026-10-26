import { Module } from '@nestjs/common';
import { ProfissionaisController } from './controller/profissionais.controller';
import { ProfissionaisService } from './service/profissionais.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProfissionaisController],
  providers: [ProfissionaisService],
})
export class ProfissionaisModule {}

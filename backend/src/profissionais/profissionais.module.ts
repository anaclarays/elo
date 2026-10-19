import { Module } from '@nestjs/common';
import { ProfissionaisController } from './controller/profissionais.controller';
import { ProfissionaisService } from './service/profissionais.service';

@Module({
  controllers: [ProfissionaisController],
  providers: [ProfissionaisService],
})
export class ProfissionaisModule {}
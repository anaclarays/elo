import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ListaEsperaController } from './controller/lista-espera.controller';
import { ListaEsperaRepository } from './lista-espera.repository';
import { ListaEsperaService } from './service/lista-espera.service';

@Module({
  imports: [AuthModule],
  controllers: [ListaEsperaController],
  providers: [ListaEsperaService, ListaEsperaRepository],
  // Os cadastros de paciente (e, depois, a agenda) usam o service
  exports: [ListaEsperaService],
})
export class ListaEsperaModule {}

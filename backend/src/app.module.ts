import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { ProfissionaisModule } from './profissionais/profissionais.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ProfissionaisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

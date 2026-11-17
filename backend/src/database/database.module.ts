import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool, types } from 'pg';
import { DatabaseService } from './database.service';
import { PG_POOL } from './database.constants';

// Colunas DATE voltam como texto "AAAA-MM-DD"
types.setTypeParser(1082, (valor: string) => valor);
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new Pool({
          connectionString: config.get<string>('DATABASE_URL'),
          ssl: { rejectUnauthorized: false },
        });
      },
    },
    DatabaseService,
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}

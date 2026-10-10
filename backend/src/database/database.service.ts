   import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
   import { Pool } from 'pg';
   import { PG_POOL } from './database.constants';

   @Injectable()
   export class DatabaseService implements OnModuleInit {
     constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

     async onModuleInit() {
       const result = await this.pool.query('SELECT NOW()');
       console.log('Conexão com o PostgreSQL (Neon) estabelecida:', result.rows[0]);
     }
   }
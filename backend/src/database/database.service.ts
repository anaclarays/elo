import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './database.constants';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pacientes (
        id SERIAL PRIMARY KEY,
        numero_cadastro VARCHAR(255) NOT NULL,
        nome_beneficiario VARCHAR(255) NOT NULL,
        data_nascimento DATE NOT NULL,
        rg VARCHAR(50) NOT NULL,
        cpf VARCHAR(20) NOT NULL,
        nome_mae VARCHAR(255) NOT NULL,
        endereco TEXT NOT NULL,
        numero VARCHAR(50) NOT NULL,
        bairro VARCHAR(255) NOT NULL,
        cidade VARCHAR(255) NOT NULL,
        cep VARCHAR(20) NOT NULL,
        estado VARCHAR(2) NOT NULL,
        contato VARCHAR(50) NOT NULL,
        email VARCHAR(255) NOT NULL,
        possui_irmaos BOOLEAN NOT NULL,
        quantidade_irmaos INTEGER,
        nomes_irmaos TEXT,
        escola_frequenta VARCHAR(255) NOT NULL,
        serie VARCHAR(100) NOT NULL,
        possui_deficit BOOLEAN NOT NULL,
        queixa VARCHAR(100),
        faz_acompanhamento BOOLEAN NOT NULL,
        quais_acompanhamentos TEXT,
        faz_uso_medicacao BOOLEAN NOT NULL,
        quais_medicacoes TEXT,
        nome_pai VARCHAR(255),
        acompanhante_escolar VARCHAR(255),
        data_cadastro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const result = await this.pool.query('SELECT NOW()');
    console.log('Conexão com o PostgreSQL (Neon) estabelecida:', result.rows[0]);
  }
}

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

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS profissionais (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome_completo TEXT NOT NULL,
        cpf TEXT NOT NULL UNIQUE,
        telefone TEXT,
        email TEXT NOT NULL UNIQUE,
        area_atuacao TEXT NOT NULL,
        cargo TEXT,
        senha_hash TEXT NOT NULL,
        capacidade_semanal INTEGER,
        periodos TEXT[],
        horario_inicio TIME,
        horario_fim TIME,
        status TEXT,
        telefone_atendimento TEXT,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      ALTER TABLE profissionais
        ALTER COLUMN telefone DROP NOT NULL,
        ALTER COLUMN cargo DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS consentimento_lgpd_em TIMESTAMPTZ
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS recuperacao_senha_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expira_em TIMESTAMPTZ NOT NULL,
        usado_em TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Decisões das Sugestões de IA (mesmo conteúdo da migration 007), criadas aqui
    // para a tela funcionar mesmo em bancos onde a migration ainda não rodou
    await this.pool.query(`
      DO $$ BEGIN
        CREATE TYPE decisao_sugestao_enum AS ENUM ('aprovada', 'descartada');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS decisoes_sugestoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sugestao_id VARCHAR(64) NOT NULL UNIQUE,
        tipo VARCHAR(30) NOT NULL
          CHECK (tipo IN ('sobrecarga', 'vaga_fila', 'reducao_frequencia')),
        titulo TEXT NOT NULL,
        decisao decisao_sugestao_enum NOT NULL,
        motivo TEXT,
        profissionais UUID[] NOT NULL DEFAULT '{}',
        decidido_por UUID NOT NULL REFERENCES profissionais(id),
        decidido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT decisao_motivo_ck
          CHECK (decisao = 'aprovada' OR btrim(coalesce(motivo, '')) <> '')
      )
    `);

    // Bancos que rodaram a primeira versão da migration 007 não têm esta coluna
    await this.pool.query(`
      ALTER TABLE decisoes_sugestoes
        ADD COLUMN IF NOT EXISTS profissionais UUID[] NOT NULL DEFAULT '{}'
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS decisoes_sugestoes_decidido_em_idx
        ON decisoes_sugestoes (decidido_em DESC)
    `);

    const result = await this.pool.query('SELECT NOW()');
    console.log('Conexão com o PostgreSQL (Neon) estabelecida:', result.rows[0]);
  }
}

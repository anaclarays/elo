import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

async function seedProfissional() {
  const connectionString = process.env.DATABASE_URL;
  const nome = process.env.SEED_NOME?.trim();
  const cpf = process.env.SEED_CPF?.replace(/\D/g, '');
  const telefone = process.env.SEED_TELEFONE?.trim();
  const email = process.env.SEED_EMAIL?.trim().toLowerCase();
  const areaAtuacao = process.env.SEED_AREA_ATUACAO?.trim();
  const cargo = process.env.SEED_CARGO?.trim();
  const senha = process.env.SEED_SENHA;

  if (
    !connectionString ||
    !nome ||
    !cpf ||
    !telefone ||
    !email ||
    !areaAtuacao ||
    !cargo ||
    !senha
  ) {
    throw new Error(
      'Configure DATABASE_URL e todas as variáveis SEED_* antes de executar o seed.',
    );
  }
  if (senha.length < 8)
    throw new Error('SEED_SENHA deve conter ao menos 8 caracteres.');

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const existente = await pool.query('SELECT 1 FROM profissionais LIMIT 1');
    if (existente.rowCount)
      throw new Error(
        'Já existe profissional cadastrado; seed inicial cancelado.',
      );
    const senhaHash = await bcrypt.hash(senha, 12);
    await pool.query(
      `INSERT INTO profissionais
        (nome_completo, cpf, telefone, email, area_atuacao, cargo, senha_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [nome, cpf, telefone, email, areaAtuacao, cargo, senhaHash],
    );
    console.log('Profissional inicial cadastrado.');
  } finally {
    await pool.end();
  }
}

seedProfissional().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Falha no seed inicial.',
  );
  process.exitCode = 1;
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PG_POOL } from '../../database/database.constants';

describe('Cadastro e acesso por área', () => {
  let app: INestApplication;
  const query = jest.fn();
  const senha = 'Senha!123';
  const cadastro = {
    nomeCompleto: 'Pessoa de Teste',
    cpf: '11144477735',
    email: 'pessoa@example.com',
    senha,
    consentimentoLgpd: true,
  };

  beforeAll(async () => {
    query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('INSERT INTO profissionais')) {
        return {
          rows: [{
            id: '045f2486-f972-4fc6-8944-d8127d7b3322',
            nome_completo: params[0],
            email: params[3],
            area_atuacao: params[4],
            cargo: params[5],
          }],
        };
      }
      return { rows: [] };
    });
    const config: Record<string, string> = {
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PG_POOL).useValue({ query })
      .overrideProvider(ConfigService).useValue({ get: (key: string) => config[key] })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  it.each(['voluntariado_saude', 'voluntariado_educacao'])(
    'inicia a sessão de %s sem dados opcionais e restringe a Gestão',
    async (areaAtuacao) => {
      const { body } = await request(app.getHttpServer()).post('/auth/cadastro')
        .send({ ...cadastro, areaAtuacao }).expect(201);
      expect(body.profissional).toMatchObject({ areaAtuacao, cargo: null });
      const authorization = `Bearer ${body.accessToken}`;
      await request(app.getHttpServer()).get('/pacientes').set('Authorization', authorization).expect(200);
      await request(app.getHttpServer()).get('/profissionais').set('Authorization', authorization).expect(403);
    },
  );

  it('cadastra a Coordenação com entrada automática, libera Equipe e impede alterar a área', async () => {
    const areaAtuacao = 'coordenacao_administrativa';
    const { body } = await request(app.getHttpServer()).post('/auth/cadastro')
      .send({ ...cadastro, areaAtuacao }).expect(201);
    expect(body.profissional).toMatchObject({ areaAtuacao });
    const authorization = `Bearer ${body.accessToken}`;
    await request(app.getHttpServer()).get('/profissionais').set('Authorization', authorization).expect(200);
    await request(app.getHttpServer()).patch(`/profissionais/${body.profissional.id}`)
      .set('Authorization', authorization).send({ areaAtuacao: 'voluntariado_saude' }).expect(400);
  });

  it('exige consentimento de tratamento de dados no cadastro', async () => {
    await request(app.getHttpServer()).post('/auth/cadastro')
      .send({ ...cadastro, consentimentoLgpd: false, areaAtuacao: 'voluntariado_saude' }).expect(400);
  });
});

import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PG_POOL } from '../../database/database.constants';
import { DatabaseModule } from '../../database/database.module';
import { AtendimentosController } from '../controller/atendimentos.controller';
import { AtendimentosModule } from '../atendimentos.module';
import { AtendimentosService } from '../service/atendimentos.service';

describe('AtendimentosModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        DatabaseModule,
        AtendimentosModule,
      ],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) =>
          ({
            JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
            SMTP_PORT: '2525',
          })[key],
      })
      .overrideProvider(PG_POOL)
      .useValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        connect: jest.fn(),
        end: jest.fn(),
      })
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('resolve as dependências do controller e do service', async () => {
    await expect(module.init()).resolves.toBeDefined();
    expect(module.get(AtendimentosController)).toBeInstanceOf(
      AtendimentosController,
    );
    expect(module.get(AtendimentosService)).toBeInstanceOf(AtendimentosService);
  });
});

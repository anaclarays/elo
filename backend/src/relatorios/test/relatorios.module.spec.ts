import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PG_POOL } from '../../database/database.constants';
import { DatabaseModule } from '../../database/database.module';
import { RelatoriosController } from '../controller/relatorios.controller';
import { RelatoriosModule } from '../relatorios.module';
import { RelatoriosService } from '../service/relatorios.service';

describe('RelatoriosModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        DatabaseModule,
        RelatoriosModule,
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
    expect(module.get(RelatoriosController)).toBeInstanceOf(
      RelatoriosController,
    );
    expect(module.get(RelatoriosService)).toBeInstanceOf(RelatoriosService);
  });
});

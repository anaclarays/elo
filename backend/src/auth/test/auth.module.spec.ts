import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth.module';
import { PG_POOL } from '../../database/database.constants';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';

describe('AuthModule', () => {
  it('resolve AuthController dependencies, incluindo AuthService', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true }),
        DatabaseModule,
        AuthModule,
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

    await expect(module.init()).resolves.toBeDefined();
    await module.close();
  });
});

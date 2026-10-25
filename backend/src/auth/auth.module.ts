import { Module } from '@nestjs/common';
import { AuthController } from './controller/auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { StringValue } from 'ms';
import { ThrottlerModule } from '@nestjs/throttler';
import nodemailer from 'nodemailer';
import { MAIL_TRANSPORT } from './service/auth.service';

@Module({
  controllers: [AuthController],
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) {
          throw new Error(
            'JWT_SECRET deve estar configurado com pelo menos 32 caracteres',
          );
        }
        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
              '15m') as StringValue,
          },
        };
      },
    }),
  ],
  providers: [
    JwtAuthGuard,
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const port = Number(config.get<string>('SMTP_PORT') ?? 587);
        return nodemailer.createTransport({
          host: config.get<string>('SMTP_HOST'),
          port,
          secure: port === 465,
          auth: {
            user: config.get<string>('SMTP_USER'),
            pass: config.get<string>('SMTP_PASS'),
          },
        });
      },
    },
  ],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}

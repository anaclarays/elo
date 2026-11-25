import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AreaAtuacao } from '../../profissionais/dto/create-profissional.dto';

@Injectable()
export class CoordenacaoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    return user?.areaAtuacao === AreaAtuacao.COORDENACAO_ADMINISTRATIVA;
  }
}

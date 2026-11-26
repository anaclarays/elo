import { CoordenacaoGuard } from '../../auth/guards/coordenacao.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PacientesController } from '../controller/pacientes.controller';

describe('PacientesController', () => {
  const guardsDa = (rota: keyof PacientesController) =>
    (Reflect.getMetadata('__guards__', PacientesController.prototype[rota]) ??
      []) as unknown[];

  it('exige o perfil de coordenação para excluir um paciente', () => {
    expect(guardsDa('remove')).toEqual([JwtAuthGuard, CoordenacaoGuard]);
  });

  it('não exige o perfil de coordenação nas demais rotas', () => {
    for (const rota of [
      'create',
      'findAll',
      'findOne',
      'update',
      'replace',
    ] as const) {
      expect(guardsDa(rota)).toContain(JwtAuthGuard);
      expect(guardsDa(rota)).not.toContain(CoordenacaoGuard);
    }
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DescartarSugestaoDto } from '../dto/descartar-sugestao.dto';

async function camposComErro(dados: object): Promise<string[]> {
  const erros = await validate(plainToInstance(DescartarSugestaoDto, dados));
  return erros.map((erro) => erro.property);
}

describe('DescartarSugestaoDto', () => {
  it('aceita um motivo e remove os espaços das pontas', async () => {
    const dto = plainToInstance(DescartarSugestaoDto, {
      motivo: '  Família pediu outro horário  ',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.motivo).toBe('Família pediu outro horário');
  });

  it.each([
    {},
    { motivo: '' },
    { motivo: '   ' },
    { motivo: 3 },
    { motivo: 'a'.repeat(501) },
  ])(
    'recusa motivo ausente, vazio, inválido ou longo demais (%j)',
    async (dados) => {
      await expect(camposComErro(dados)).resolves.toEqual(['motivo']);
    },
  );
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DescartarSugestaoDto } from '../dto/descartar-sugestao.dto';
import { ModificarSugestaoDto } from '../dto/modificar-sugestao.dto';

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

describe('ModificarSugestaoDto', () => {
  const erros = async (dados: object) =>
    (await validate(plainToInstance(ModificarSugestaoDto, dados))).map(
      (erro) => erro.property,
    );

  it('aceita os ajustes e converte a data', async () => {
    const dto = plainToInstance(ModificarSugestaoDto, {
      motivo: ' Outro horário ',
      profissionalId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      dataInicio: '2026-11-27T09:00:00-03:00',
      tipo: 'pedagogia',
    });
    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.motivo).toBe('Outro horário');
    expect(dto.dataInicio).toEqual(new Date('2026-11-27T12:00:00Z'));
  });

  it.each([
    [{}, ['motivo']],
    [{ motivo: 'x', profissionalId: 'abc' }, ['profissionalId']],
    [{ motivo: 'x', dataInicio: '2026-11-27' }, ['dataInicio']],
    [{ motivo: 'x', tipo: 'dança' }, ['tipo']],
    [{ motivo: 'x', atendimentoIds: [] }, ['atendimentoIds']],
    [{ motivo: 'x', atendimentoIds: ['abc'] }, ['atendimentoIds']],
  ])('recusa dados inválidos (%j)', async (dados, campos) => {
    await expect(erros(dados)).resolves.toEqual(campos);
  });
});

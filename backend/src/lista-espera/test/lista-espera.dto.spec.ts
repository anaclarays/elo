import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdicionarListaEsperaDto } from '../dto/adicionar-lista-espera.dto';
import { RetirarListaEsperaDto } from '../dto/retirar-lista-espera.dto';

async function camposComErro<T extends object>(
  classe: new () => T,
  dados: object,
): Promise<string[]> {
  const erros = await validate(plainToInstance(classe, dados));
  return erros.map((erro) => erro.property);
}

describe('AdicionarListaEsperaDto', () => {
  it('aceita paciente comum com id inteiro', async () => {
    await expect(
      camposComErro(AdicionarListaEsperaDto, {
        tipoPaciente: 'beneficiario',
        pacienteId: 7,
      }),
    ).resolves.toEqual([]);
  });

  it('aceita paciente TEA com id UUID', async () => {
    await expect(
      camposComErro(AdicionarListaEsperaDto, {
        tipoPaciente: 'tea',
        pacienteId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      }),
    ).resolves.toEqual([]);
  });

  it.each([
    ['beneficiario', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
    ['beneficiario', 0],
    ['beneficiario', -3],
    ['beneficiario', 1.5],
    ['tea', 7],
    ['tea', 'nao-e-uuid'],
  ])('recusa id incompatível com o tipo (%s, %j)', async (tipo, id) => {
    await expect(
      camposComErro(AdicionarListaEsperaDto, {
        tipoPaciente: tipo,
        pacienteId: id,
      }),
    ).resolves.toEqual(['pacienteId']);
  });

  it('recusa tipo de paciente desconhecido', async () => {
    const campos = await camposComErro(AdicionarListaEsperaDto, {
      tipoPaciente: 'outro',
      pacienteId: 7,
    });

    expect(campos).toContain('tipoPaciente');
  });

  it('exige o id do paciente', async () => {
    const campos = await camposComErro(AdicionarListaEsperaDto, {
      tipoPaciente: 'tea',
    });

    expect(campos).toContain('pacienteId');
  });
});

describe('RetirarListaEsperaDto', () => {
  it('aceita justificativa preenchida e remove espaços das pontas', async () => {
    const dto = plainToInstance(RetirarListaEsperaDto, {
      justificativa: '  Família desistiu  ',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.justificativa).toBe('Família desistiu');
  });

  it.each([undefined, '', '   ', 123])(
    'recusa justificativa ausente, vazia ou inválida (%j)',
    async (justificativa) => {
      await expect(
        camposComErro(RetirarListaEsperaDto, { justificativa }),
      ).resolves.toEqual(['justificativa']);
    },
  );

  it('recusa justificativa com mais de 1000 caracteres', async () => {
    await expect(
      camposComErro(RetirarListaEsperaDto, {
        justificativa: 'a'.repeat(1001),
      }),
    ).resolves.toEqual(['justificativa']);
  });
});

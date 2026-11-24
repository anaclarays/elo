import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FiltroPeriodoDto } from '../dto/filtro-periodo.dto';

async function camposComErro(dados: object): Promise<string[]> {
  const erros = await validate(plainToInstance(FiltroPeriodoDto, dados));
  return erros.map((erro) => erro.property);
}

describe('FiltroPeriodoDto', () => {
  it('aceita período sem datas', async () => {
    await expect(camposComErro({})).resolves.toEqual([]);
  });

  it('aceita data inicial e final no formato AAAA-MM-DD', async () => {
    await expect(
      camposComErro({ dataInicio: '2026-11-01', dataFim: '2026-11-30' }),
    ).resolves.toEqual([]);
  });

  it('aceita 29 de fevereiro em ano bissexto', async () => {
    await expect(camposComErro({ dataFim: '2028-02-29' })).resolves.toEqual([]);
  });

  it.each([
    '2026-02-30',
    '2027-02-29',
    '2026-13-01',
    '01/11/2026',
    '2026-11-01T10:00:00Z',
    '2026-11',
    'ontem',
  ])('recusa data inválida ou em outro formato (%s)', async (data) => {
    await expect(
      camposComErro({ dataInicio: data, dataFim: data }),
    ).resolves.toEqual(['dataInicio', 'dataFim']);
  });

  it('informa o formato esperado na mensagem de erro', async () => {
    const [erro] = await validate(
      plainToInstance(FiltroPeriodoDto, { dataInicio: '01/11/2026' }),
    );

    expect(Object.values(erro.constraints ?? {})).toContain(
      'dataInicio deve ser uma data válida no formato AAAA-MM-DD',
    );
  });
});

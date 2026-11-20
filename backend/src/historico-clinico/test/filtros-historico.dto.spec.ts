import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { FiltrosHistoricoDto } from '../dto/filtros-historico.dto';
import { TipoRegistroClinico } from '../enum/historico-clinico.enum';

describe('FiltrosHistoricoDto', () => {
  const validar = (dados: object) =>
    validate(plainToInstance(FiltrosHistoricoDto, dados));
  const temErro = (erros: ValidationError[], propriedade: string) =>
    erros.some((erro) => erro.property === propriedade);

  it('aceita a consulta sem nenhum filtro', async () => {
    expect(await validar({})).toHaveLength(0);
  });

  it('aceita período e tipo válidos', async () => {
    const erros = await validar({
      dataInicio: '2026-09-01',
      dataFim: '2026-09-30',
      tipo: 'avaliacao',
    });
    expect(erros).toHaveLength(0);
  });

  it.each(Object.values(TipoRegistroClinico))(
    'aceita o tipo %s',
    async (tipo) => {
      expect(await validar({ tipo })).toHaveLength(0);
    },
  );

  it.each([
    [
      'dataInicio em formato errado',
      { dataInicio: '01/09/2026' },
      'dataInicio',
    ],
    ['dataFim em formato errado', { dataFim: '30-09-2026' }, 'dataFim'],
    [
      'dataInicio que não existe no calendário',
      { dataInicio: '2026-02-30' },
      'dataInicio',
    ],
    ['dataFim com mês inválido', { dataFim: '2026-13-01' }, 'dataFim'],
    ['tipo fora da lista', { tipo: 'consulta' }, 'tipo'],
    ['tipo vazio', { tipo: '' }, 'tipo'],
  ])('rejeita %s', async (_descricao, dados, propriedade) => {
    const erros = await validar(dados);
    expect(temErro(erros, propriedade)).toBe(true);
  });
});
// As data são só valores de entrada para os filtros, não há validação de consistência entre elas (dataInicio <= dataFim).
// A validação de período é feita no service, que lança BadRequestException se a data inicial for posterior à final.

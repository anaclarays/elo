import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  CreateAtendimentoDto,
  TipoAtendimento,
} from '../dto/create-atendimento.dto';

describe('CreateAtendimentoDto', () => {
  const dtoValido = {
    pacienteId: 23,
    isTea: false,
    profissionalId: '7a63fc53-ea95-4cd7-8a59-dd45d807d696',
    dataInicio: new Date('2030-10-29T13:00:00.000Z'),
    tipo: TipoAtendimento.PSICOLOGIA,
  };

  const validar = (dados: object) =>
    validate(plainToInstance(CreateAtendimentoDto, dados));
  const temErro = (erros: ValidationError[], propriedade: string) =>
    erros.some((erro) => erro.property === propriedade);

  it('aceita um atendimento para paciente comum com id inteiro positivo', async () => {
    expect(await validar(dtoValido)).toHaveLength(0);
  });

  it('aceita um atendimento para paciente TEA com id string', async () => {
    const erros = await validar({
      ...dtoValido,
      pacienteId: 'e695038b-6355-4db4-b833-48f5062a3aab',
      isTea: true,
    });

    expect(erros).toHaveLength(0);
  });

  it.each([
    ['id comum em formato string', { pacienteId: '23' }, 'pacienteId'],
    ['id comum igual a zero', { pacienteId: 0 }, 'pacienteId'],
    ['id comum negativo', { pacienteId: -1 }, 'pacienteId'],
    ['id comum decimal', { pacienteId: 1.5 }, 'pacienteId'],
    [
      'id de paciente TEA numérico',
      { pacienteId: 23, isTea: true },
      'pacienteId',
    ],
    ['id de paciente TEA vazio', { pacienteId: '', isTea: true }, 'pacienteId'],
    [
      'id de paciente TEA que não é UUID',
      { pacienteId: 'abc', isTea: true },
      'pacienteId',
    ],
    [
      'profissional que não é UUID',
      { profissionalId: 'abc' },
      'profissionalId',
    ],
    [
      'data de início sem fuso horário',
      { dataInicio: '2030-10-29T10:00:00' },
      'dataInicio',
    ],
    ['profissional vazio', { profissionalId: '' }, 'profissionalId'],
    ['profissional não string', { profissionalId: 23 }, 'profissionalId'],
    [
      'data de início em formato inválido',
      { dataInicio: '2030-10-29' },
      'dataInicio',
    ],
    ['tipo inválido', { tipo: 'consulta' }, 'tipo'],
    ['isTea não booleano', { isTea: 'false' }, 'isTea'],
  ])('rejeita %s', async (_descricao, alteracao, propriedade) => {
    const erros = await validar({ ...dtoValido, ...alteracao });

    expect(temErro(erros, propriedade)).toBe(true);
  });

  it('rejeita pacienteId ausente', async () => {
    const erros = await validar({ ...dtoValido, pacienteId: undefined });

    expect(temErro(erros, 'pacienteId')).toBe(true);
  });

  it('rejeita isTea ausente', async () => {
    const erros = await validar({ ...dtoValido, isTea: undefined });

    expect(temErro(erros, 'isTea')).toBe(true);
  });

  it('converte a data de início enviada como texto no JSON', async () => {
    const dto = plainToInstance(CreateAtendimentoDto, {
      ...dtoValido,
      dataInicio: '2030-10-29T10:00:00-03:00',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.dataInicio).toEqual(new Date('2030-10-29T13:00:00.000Z'));
  });
});

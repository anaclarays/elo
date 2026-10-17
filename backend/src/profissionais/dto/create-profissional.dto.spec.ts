import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProfissionalDto, AreaAtuacao } from './create-profissional.dto';

describe('CreateProfissionalDto', () => {
  const dtoValido = {
    nomeCompleto: 'Teste da Silva',
    cpf: '11144477735',
    telefone: '81999999999',
    email: 'teste@teste.com',
    areaAtuacao: AreaAtuacao.COORDENACAO_ADMINISTRATIVA,
    cargo: 'Cargo',
    senha: 'Senha@123',
  };

  it('nao deve ter erros com dados validos', async () => {
    const dto = plainToInstance(CreateProfissionalDto, dtoValido);
    const erros = await validate(dto);
    expect(erros).toHaveLength(0);
  });

  it('deve rejeitar CPF invalido', async () => {
    const dto = plainToInstance(CreateProfissionalDto, {
      ...dtoValido,
      cpf: '12345678900',
    });
    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'cpf')).toBe(true);
  });

  it('deve rejeitar e-mail mal formatado', async () => {
    const dto = plainToInstance(CreateProfissionalDto, {
      ...dtoValido,
      email: 'nao-e-um-email',
    });
    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'email')).toBe(true);
  });

  it('deve rejeitar area de atuacao fora das 3 opcoes permitidas', async () => {
    const dto = plainToInstance(CreateProfissionalDto, {
      ...dtoValido,
      areaAtuacao: 'jardinagem',
    });
    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'areaAtuacao')).toBe(true);
  });

  it.each([
    ['sem maiuscula', 'senha@123'],
    ['sem minuscula', 'SENHA@123'],
    ['sem numero', 'Senha@abc'],
    ['sem caractere especial', 'Senha1234'],
    ['menos de 8 caracteres', 'Sh@1'],
  ])('deve rejeitar senha %s', async (_descricao, senhaInvalida) => {
    const dto = plainToInstance(CreateProfissionalDto, {
      ...dtoValido,
      senha: senhaInvalida,
    });
    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'senha')).toBe(true);
  });

  it('deve rejeitar quando nomeCompleto esta vazio', async () => {
    const dto = plainToInstance(CreateProfissionalDto, {
      ...dtoValido,
      nomeCompleto: '',
    });
    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'nomeCompleto')).toBe(true);
  });
});
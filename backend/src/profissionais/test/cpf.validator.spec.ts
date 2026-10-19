import { isValidCpf } from '../validators/cpf.validator';

describe('isValidCpf', () => {
  it('deve validar um CPF correto', () => {
    expect(isValidCpf('11144477735')).toBe(true);
  });

  it('deve validar um CPF correto com pontuação', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true);
  });

  it('deve rejeitar CPF com dígitos verificadores errados', () => {
    expect(isValidCpf('11144477736')).toBe(false);
  });

  it('deve rejeitar CPF com todos os dígitos iguais', () => {
    expect(isValidCpf('11111111111')).toBe(false);
  });

  it('deve rejeitar CPF com menos de 11 dígitos', () => {
    expect(isValidCpf('123456789')).toBe(false);
  });

  it('deve rejeitar CPF vazio', () => {
    expect(isValidCpf('')).toBe(false);
  });

  it('deve rejeitar entrada não numérica', () => {
    expect(isValidCpf('abcdefghijk')).toBe(false);
  });
});
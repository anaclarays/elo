import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateBeneficiarioDto,
  QueixaAprendizado,
  UpdateBeneficiarioDto,
} from './create-paciente.dto';

const validPaciente = {
  numeroCadastro: '12345',
  nomeBeneficiario: 'João',
  dataNascimento: '2010-01-01',
  rg: '1234567',
  cpf: '123.456.789-00',
  nomeMae: 'Maria',
  endereco: 'Rua A',
  numero: '10',
  bairro: 'Centro',
  cidade: 'Araripina',
  cep: '56280-000',
  estado: 'PE',
  contato: '87999999999',
  email: 'joao@email.com',
  possuiIrmaos: false,
  escolaFrequenta: 'Escola Municipal',
  serie: '7º Ano',
  possuiDefice: false,
  fazAcompanhamento: false,
  fazUsoMedicacao: false,
};

describe('CreateBeneficiarioDto', () => {
  it('accepts all required data when conditional questions are answered no', async () => {
    const dto = plainToInstance(CreateBeneficiarioDto, validPaciente);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects missing required fields and invalid values', async () => {
    const dto = plainToInstance(CreateBeneficiarioDto, {
      ...validPaciente,
      email: 'inválido',
      dataNascimento: 'data inválida',
      nomeMae: '',
    });

    const errors = await validate(dto);
    const invalidFields = errors.map((error) => error.property);

    expect(invalidFields).toEqual(
      expect.arrayContaining(['email', 'dataNascimento', 'nomeMae']),
    );
  });

  it('requires dependent answers when the corresponding answer is yes', async () => {
    const dto = plainToInstance(CreateBeneficiarioDto, {
      ...validPaciente,
      possuiIrmaos: true,
      possuiDefice: true,
      fazAcompanhamento: true,
      fazUsoMedicacao: true,
    });

    const errors = await validate(dto);
    const invalidFields = errors.map((error) => error.property);

    expect(invalidFields).toEqual(
      expect.arrayContaining([
        'quantidadeIrmaos',
        'nomesIrmaos',
        'queixa',
        'quaisAcompanhamentos',
        'quaisMedicacoes',
      ]),
    );
  });

  it('accepts dependent answers only when they use valid values', async () => {
    const dto = plainToInstance(CreateBeneficiarioDto, {
      ...validPaciente,
      possuiIrmaos: true,
      quantidadeIrmaos: 2,
      nomesIrmaos: 'Ana e Pedro',
      possuiDefice: true,
      queixa: QueixaAprendizado.LEITURA,
      fazAcompanhamento: true,
      quaisAcompanhamentos: 'Psicopedagogia',
      fazUsoMedicacao: true,
      quaisMedicacoes: 'Medicamento A',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('allows partial updates', async () => {
    const dto = plainToInstance(UpdateBeneficiarioDto, {
      nomeBeneficiario: 'João Silva',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});

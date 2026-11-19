import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdicionarListaEsperaDto } from '../dto/adicionar-lista-espera.dto';
import { MotivoSaida, PacienteRef } from '../enum/lista-espera.enum';
import {
  ExecutorSql,
  FiltrosFila,
  ListaEsperaRepository,
} from '../lista-espera.repository';

const MENSAGEM_JA_NA_LISTA = 'O paciente já está na lista de espera';

@Injectable()
export class ListaEsperaService {
  constructor(private readonly repository: ListaEsperaRepository) {}

  registrarNoCadastro(paciente: PacienteRef, executor?: ExecutorSql) {
    return this.repository.registrar(paciente, executor);
  }

  consultar(filtros?: FiltrosFila) {
    return this.repository.listarFila(filtros);
  }

  async adicionarManualmente(dto: AdicionarListaEsperaDto) {
    const paciente: PacienteRef = {
      tipo: dto.tipoPaciente,
      id: dto.pacienteId,
    };

    if (!(await this.repository.pacienteAtivoExiste(paciente))) {
      throw new NotFoundException('Paciente não encontrado');
    }
    if (await this.repository.existeRegistroAtivo(paciente)) {
      throw new ConflictException(MENSAGEM_JA_NA_LISTA);
    }

    try {
      return await this.repository.registrar(paciente);
    } catch (erro: any) {
      // 23505 = violação de unicidade no banco (duas inclusões ao mesmo tempo)
      if (erro?.code === '23505') {
        throw new ConflictException(MENSAGEM_JA_NA_LISTA);
      }
      throw erro;
    }
  }

  async retirarManualmente(
    id: string,
    justificativa: string,
    profissionalId: string,
  ) {
    const texto = justificativa?.trim();
    if (!texto) {
      throw new BadRequestException('Informe a justificativa da retirada');
    }

    const registro = await this.repository.encerrar(id, MotivoSaida.MANUAL, {
      justificativa: texto,
      retiradoPor: profissionalId,
    });
    if (!registro) {
      throw new NotFoundException(
        'Registro ativo na lista de espera não encontrado',
      );
    }
    return registro;
  }

  retirarPorAgendamento(paciente: PacienteRef, executor?: ExecutorSql) {
    return this.repository.encerrarPorPaciente(
      paciente,
      MotivoSaida.AGENDAMENTO,
      executor,
    );
  }
}

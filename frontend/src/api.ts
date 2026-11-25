export const areas = {
  coordenacao_administrativa: 'Coordenação Administrativa',
  voluntariado_saude: 'Voluntariado - Saúde',
  voluntariado_educacao: 'Voluntariado - Educação',
};

export type Area = keyof typeof areas;

export interface Session {
  accessToken: string;
  profissional: {
    id: string;
    nomeCompleto: string;
    email: string;
    cargo: string | null;
    areaAtuacao: Area;
  };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, options: { body?: object; token?: string } = {}) {
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  let response: Response;

  try {
    response = await fetch(base + path, {
      method: options.body ? 'POST' : 'GET',
      headers,
      body: options.body && JSON.stringify(options.body),
    });
  } catch {
    throw new Error('Não foi possível conectar ao sistema. Tente novamente.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = response.status === 429
      ? 'Muitas tentativas. Aguarde um minuto e tente novamente.'
      : data?.message;
    throw new ApiError(
      response.status,
      Array.isArray(message) ? message.join('. ') : message || 'Não foi possível concluir a solicitação. Tente novamente.',
    );
  }
  return data as T;
}

export function expiration(token: string) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Number(payload.exp) * 1000 || 0;
  } catch {
    return 0;
  }
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3340';

const CHAVE = 'corr_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(CHAVE, t);
    else localStorage.removeItem(CHAVE);
  } catch {
    /* navegação privada */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function mensagemErro(corpo: any, status: number) {
  const m = corpo?.message;
  if (Array.isArray(m)) return m[0];
  if (typeof m === 'string') return m;
  if (status === 413) return 'Arquivo grande demais';
  return 'Algo deu errado. Tente novamente.';
}

export async function api<T = any>(
  caminho: string,
  opcoes: { method?: string; body?: unknown; form?: FormData; publico?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = opcoes.publico ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opcoes.form) body = opcoes.form;
  else if (opcoes.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opcoes.body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${caminho}`, { method: opcoes.method ?? (body ? 'POST' : 'GET'), headers, body });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor');
  }
  const texto = await res.text();
  let corpo: any = texto;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    /* texto puro */
  }
  if (!res.ok) {
    if (res.status === 401 && !opcoes.publico && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) {
      setToken(null);
      location.href = '/login';
    }
    throw new ApiError(res.status, mensagemErro(corpo, res.status));
  }
  return corpo as T;
}

/** Abre um arquivo protegido (anexo) numa nova aba, enviando o token. */
export async function abrirArquivo(caminho: string, publico = false) {
  const janela = window.open('', '_blank');
  const headers: Record<string, string> = {};
  const token = publico ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${caminho}`, { headers });
  if (!res.ok) {
    janela?.close();
    throw new ApiError(res.status, 'Não foi possível abrir o arquivo');
  }
  const url = URL.createObjectURL(await res.blob());
  if (janela) janela.location.href = url;
  else window.location.href = url;
}

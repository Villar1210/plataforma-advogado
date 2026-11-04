'use client';

import { Loader2, X } from 'lucide-react';
import {
  ButtonHTMLAttributes,
  createContext,
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma' | 'sucesso';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca-700 text-white hover:bg-marca-800 shadow-sm',
  secundario: 'bg-white text-gray-800 ring-1 ring-gray-300 hover:bg-gray-50',
  perigo: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50',
  fantasma: 'text-gray-600 hover:bg-gray-100',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
};

export function Botao({
  variante = 'primario',
  carregando,
  tamanho = 'md',
  className,
  children,
  disabled,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean; tamanho?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      disabled={disabled || carregando}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        tamanho === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm',
        VARIANTES[variante],
        className,
      )}
    >
      {carregando && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

const CAMPO = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-marca-500 focus:outline-none focus:ring-2 focus:ring-marca-100 disabled:bg-gray-50';

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada(
  { className, ...p },
  ref,
) {
  return <input ref={ref} {...p} className={cx(CAMPO, className)} />;
});

export function Area({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={cx(CAMPO, 'resize-y', className)} />;
}

export function Selecao({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cx(CAMPO, 'pr-8', className)}>
      {children}
    </select>
  );
}

export function Campo({ rotulo, dica, children, className }: { rotulo: string; dica?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-gray-700">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-gray-500">{dica}</span>}
    </label>
  );
}

export function Cartao({ children, className, titulo, acao }: { children: ReactNode; className?: string; titulo?: ReactNode; acao?: ReactNode }) {
  return (
    <section className={cx('rounded-xl border border-gray-200 bg-white', className)}>
      {titulo && (
        <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>
          {acao}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Selo({ children, cor }: { children: ReactNode; cor: string }) {
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', cor)}>{children}</span>;
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {texto}
    </div>
  );
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-gray-900">{titulo}</p>
      {texto && <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}

export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
  largura = 'max-w-lg',
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 p-0 sm:items-center sm:p-4" onMouseDown={aoFechar}>
      <div
        className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', largura)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <h2 className="font-semibold text-gray-900">{titulo}</h2>
          <button onClick={aoFechar} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ───────── avisos (toast) ─────────

type Aviso = { id: number; texto: string; tipo: 'ok' | 'erro' };
const AvisoCtx = createContext<(texto: string, tipo?: 'ok' | 'erro') => void>(() => {});

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((texto: string, tipo: 'ok' | 'erro' = 'ok') => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'erro' ? 6000 : 3500);
  }, []);
  return (
    <AvisoCtx.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={cx(
              'pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg',
              a.tipo === 'erro' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white',
            )}
          >
            {a.texto}
          </div>
        ))}
      </div>
    </AvisoCtx.Provider>
  );
}

export const useAviso = () => useContext(AvisoCtx);

/** Executa uma ação, mostra erro como aviso e devolve o resultado. */
export function useAcao() {
  const avisar = useAviso();
  const [carregando, setCarregando] = useState<string | null>(null);
  const executar = useCallback(
    async <T,>(chave: string, fn: () => Promise<T>, sucesso?: string): Promise<T | undefined> => {
      setCarregando(chave);
      try {
        const r = await fn();
        if (sucesso) avisar(sucesso);
        return r;
      } catch (e: any) {
        avisar(e?.message ?? 'Erro', 'erro');
        return undefined;
      } finally {
        setCarregando(null);
      }
    },
    [avisar],
  );
  return { executar, carregando };
}

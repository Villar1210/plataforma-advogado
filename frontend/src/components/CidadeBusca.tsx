'use client';

import { MapPin, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Cidade } from '@/lib/tipos';
import { cx, Entrada } from './ui';

export function CidadeBusca({
  valor,
  aoEscolher,
  placeholder = 'Digite a cidade',
  limparAoEscolher,
}: {
  valor?: Cidade | null;
  aoEscolher: (c: Cidade | null) => void;
  placeholder?: string;
  limparAoEscolher?: boolean;
}) {
  const [texto, setTexto] = useState('');
  const [opcoes, setOpcoes] = useState<Cidade[]>([]);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (texto.trim().length < 2) {
      setOpcoes([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setOpcoes(await api<Cidade[]>(`/cidades?q=${encodeURIComponent(texto)}`));
        setAtivo(0);
      } catch {
        setOpcoes([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const escolher = (c: Cidade) => {
    aoEscolher(c);
    setTexto('');
    setOpcoes([]);
    setAberto(false);
  };

  if (valor && !limparAoEscolher) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-gray-900">
          <MapPin className="h-4 w-4 text-marca-600" /> {valor.nome}/{valor.uf}
        </span>
        <button type="button" onClick={() => aoEscolher(null)} className="text-gray-400 hover:text-gray-700" aria-label="Trocar cidade">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <Entrada
        value={texto}
        placeholder={placeholder}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (!opcoes.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAtivo((a) => Math.min(a + 1, opcoes.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setAtivo((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            escolher(opcoes[ativo]);
          }
        }}
      />
      {aberto && opcoes.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {opcoes.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(c);
                }}
                className={cx('flex w-full items-center gap-2 px-3 py-2 text-left text-sm', i === ativo ? 'bg-marca-50' : 'hover:bg-gray-50')}
              >
                <MapPin className="h-4 w-4 text-gray-400" />
                {c.nome} <span className="text-gray-400">· {c.uf}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

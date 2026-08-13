"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { type Achado, buscar } from "@/app/(painel)/actions";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function BuscaGlobal() {
  const [aberta, setAberta] = useState(false);
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<Achado[]>([]);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) {
        e.preventDefault();
        setAberta(true);
      }
    };
    document.addEventListener("keydown", atalho);
    return () => document.removeEventListener("keydown", atalho);
  }, []);

  useEffect(() => {
    if (!aberta) return;
    // ponytail: 200 ms de espera basta pra não disparar uma query por tecla.
    const t = setTimeout(
      () => startTransition(async () => setAchados(await buscar(termo))),
      200,
    );
    return () => clearTimeout(t);
  }, [termo, aberta]);

  function abrir(href: string) {
    setAberta(false);
    router.push(href);
  }

  return (
    <Dialog open={aberta} onOpenChange={setAberta}>
      <DialogTrigger className="mx-3.5 mb-3.5 flex items-center gap-2 rounded-lg bg-white/7 px-3 py-2 text-left text-[12.5px] text-on-ink/80 hover:bg-white/12 hover:text-on-ink">
        <span className="flex-1">Buscar…</span>
        <kbd className="rounded bg-white/10 px-1.5 font-mono text-[10.5px] text-on-ink/70">
          /
        </kbd>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="top-[14vh] max-w-[520px] translate-y-0 gap-0 p-0"
      >
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        <input
          autoFocus
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && achados[0]) abrir(achados[0].href);
          }}
          placeholder="domínio, email, cliente ou id de mensagem…"
          className="w-full border-b px-4.5 py-4 font-mono text-sm outline-none"
        />
        {achados.map((a) => (
          <button
            type="button"
            key={a.href + a.rotulo}
            onClick={() => abrir(a.href)}
            className="flex items-center gap-3 px-4.5 py-2.5 text-left hover:bg-background"
          >
            <span className="w-[70px] shrink-0 text-[10.5px] font-bold uppercase tracking-wider text-fainter">
              {a.tipo}
            </span>
            <span className="truncate font-mono text-xs">{a.rotulo}</span>
          </button>
        ))}
        <p className="border-t px-4.5 py-2.5 text-[11px] text-ghost">
          {termo.length < 2
            ? "digite ao menos 2 caracteres"
            : achados.length === 0
              ? "nada encontrado"
              : "esc fecha · enter abre o primeiro resultado"}
        </p>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/** Busca por destinatário — escreve na URL pra o filtro sobreviver ao refresh. */
export function BuscaEnvios({ inicial }: { inicial: string }) {
  const [termo, setTermo] = useState(inicial);
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (termo === inicial) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams(params);
      p.delete("id");
      if (termo) p.set("q", termo);
      else p.delete("q");
      router.replace(`/envios?${p}`);
    }, 300);
    return () => clearTimeout(t);
  }, [termo, inicial, params, router]);

  return (
    <Input
      value={termo}
      onChange={(e) => setTermo(e.target.value)}
      placeholder="buscar destinatário…"
      className="h-8 w-60 font-mono text-xs md:text-xs"
    />
  );
}

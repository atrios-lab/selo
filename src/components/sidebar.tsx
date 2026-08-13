"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sair } from "@/app/(painel)/actions";
import { BuscaGlobal } from "@/components/busca-global";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Farol" },
  { href: "/dominios", label: "Domínios" },
  { href: "/envios", label: "Envios" },
  { href: "/supressoes", label: "Supressões" },
  { href: "/produtos", label: "Produtos" },
];

export function Sidebar({ pendencias }: { pendencias: number }) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 flex h-screen w-49 shrink-0 flex-col bg-ink text-on-ink">
      <div className="px-4.5 pt-5 pb-4 text-[19px] font-extrabold tracking-[-0.5px] text-white">
        selo<span className="text-brand">.</span>
      </div>

      <BuscaGlobal />

      {NAV.map((item) => {
        const ativo =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex items-center justify-between border-l-[3px] border-transparent px-3.5 py-2.5 hover:bg-ink-soft",
              ativo
                ? "border-brand bg-ink-soft font-bold text-white"
                : "font-medium",
            )}
          >
            {item.label}
            {item.href === "/" && pendencias > 0 && (
              <span className="rounded-full bg-brand px-[7px] text-[11px] font-extrabold text-ink">
                {pendencias}
              </span>
            )}
          </Link>
        );
      })}

      <form action={sair} className="mt-auto">
        <button
          type="submit"
          className="px-4.5 pt-2.5 pb-4.5 text-xs text-on-ink hover:text-white"
        >
          Sair
        </button>
      </form>
    </nav>
  );
}

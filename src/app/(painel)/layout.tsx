import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { filaDeAcao } from "@/lib/farol";
import { hasSession } from "@/lib/session";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasSession())) redirect("/login");
  const fila = await filaDeAcao();

  return (
    <div className="flex min-h-screen">
      <Sidebar pendencias={fila.length} />
      <main className="min-w-0 max-w-[1180px] flex-1 px-8 pt-6 pb-20">
        {children}
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { hasSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await hasSession()) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-6">
      <div className="w-90 max-w-full rounded-[14px] bg-background px-9 pt-9 pb-8">
        <div className="mb-6 text-[32px] font-extrabold leading-none tracking-[-0.5px]">
          selo<span className="text-brand">.</span>
        </div>
        <p className="mb-5 font-mono text-xs text-fainter">
          painel de operação · acesso restrito
        </p>
        <LoginForm />
      </div>
    </div>
  );
}

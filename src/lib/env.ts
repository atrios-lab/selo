/** Credenciais e config de servidor. Nada aqui pode virar NEXT_PUBLIC_. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

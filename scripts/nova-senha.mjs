// Gera o SELO_OPERATOR_PASSWORD_HASH sem que a senha apareça na tela nem no
// histórico do shell. Uso: node scripts/nova-senha.mjs
import { createInterface } from "node:readline";
import { hashPassword } from "../src/lib/password.ts";

const rl = createInterface({ input: process.stdin, output: process.stdout });

// Engole o eco dos caracteres digitados; só o prompt aparece.
let mudo = false;
const escrever = rl._writeToOutput.bind(rl);
rl._writeToOutput = (s) => escrever(mudo ? "" : s);

const senha = await new Promise((resolve) => {
  rl.question("Senha nova: ", (v) => resolve(v));
  mudo = true;
});
rl.close();
process.stdout.write("\n");

if (senha.length < 12) {
  console.error("Use ao menos 12 caracteres: o painel fica numa URL pública.");
  process.exit(1);
}

console.log("SELO_OPERATOR_PASSWORD_HASH:");
console.log(hashPassword(senha));

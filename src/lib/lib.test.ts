import assert from "node:assert/strict";
import test from "node:test";
import { AlreadyExistsException } from "@aws-sdk/client-sesv2";
import { expectedRecords } from "./dns.ts";
import { domainLabel, since } from "./labels.ts";
import { hashPassword, verifyPassword } from "./password.ts";
import { withinRateLimit } from "./rate-limit.ts";
import { formatFrom, seNovo, sesTagValue } from "./ses.ts";

test("rate limit corta na janela e libera depois dela", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 60; i++) {
    assert.equal(
      withinRateLimit("p1", { now: t0 }),
      true,
      `envio ${i} deveria passar`,
    );
  }
  assert.equal(
    withinRateLimit("p1", { now: t0 }),
    false,
    "o 61º na mesma janela deve ser barrado",
  );
  assert.equal(
    withinRateLimit("p2", { now: t0 }),
    true,
    "o limite é por produto",
  );
  assert.equal(
    withinRateLimit("p1", { now: t0 + 60_001 }),
    true,
    "passada a janela, libera",
  );
});

test("tag do SES perde os caracteres proibidos", () => {
  assert.equal(sesTagValue("convite:acme v2"), "convite_acme_v2");
  assert.equal(sesTagValue("reset-senha_1"), "reset-senha_1");
});

test("from com nome vira display name e neutraliza aspas", () => {
  assert.equal(formatFrom("noreply@acme.com.br"), "noreply@acme.com.br");
  assert.equal(
    formatFrom("noreply@acme.com.br", "Acme"),
    '"Acme" <noreply@acme.com.br>',
  );
  assert.equal(
    formatFrom("noreply@acme.com.br", 'Ac"me'),
    '"Acme" <noreply@acme.com.br>',
    "aspas no nome quebrariam o header",
  );
});

test("senha do operador: hash roundtrip e rejeição", () => {
  const stored = hashPassword("senha-do-operador");
  assert.equal(verifyPassword("senha-do-operador", stored), true);
  assert.equal(verifyPassword("senha-do-operadoR", stored), false);
  assert.equal(verifyPassword("senha-do-operador", "lixo"), false);
  assert.notEqual(
    hashPassword("senha-do-operador"),
    stored,
    "cada hash usa um salt novo",
  );
});

test("os 5 registros DNS saem dos tokens de DKIM e do MAIL FROM", () => {
  const recs = expectedRecords({
    domain: "acme.com.br",
    dkimTokens: ["a1b2c3", "d4e5f6", "g7h8i9"],
    mailFromDomain: "mail.acme.com.br",
  });

  assert.equal(recs.length, 5);
  assert.deepEqual(recs[0], {
    type: "CNAME",
    name: "a1b2c3._domainkey.acme.com.br",
    value: "a1b2c3.dkim.amazonses.com",
  });
  assert.equal(recs[3].type, "MX");
  assert.equal(recs[3].name, "mail.acme.com.br");
  assert.equal(recs[4].value, "v=spf1 include:amazonses.com ~all");
});

test("idade em português, do jeito que o painel mostra", () => {
  const agora = Date.UTC(2026, 7, 13, 12, 0, 0);
  const atras = (ms: number) => since(new Date(agora - ms), agora);

  assert.equal(atras(30_000), "agora");
  assert.equal(atras(4 * 60_000), "há 4 min");
  assert.equal(atras(3 * 3_600_000), "há 3 h");
  assert.equal(atras(42 * 86_400_000), "há 42 d");
  assert.equal(since(null), "—");
});

test("seNovo absorve 'já existe' e propaga o resto", async () => {
  assert.equal(await seNovo(Promise.resolve("criado")), "criado");

  // Provisionar de novo depois de falha parcial precisa atravessar o que já existe.
  const jaExiste = new AlreadyExistsException({
    message: "Email identity already exists",
    $metadata: {},
  });
  assert.equal(await seNovo(Promise.reject(jaExiste)), null);

  // Credencial errada, throttling, rede: continuam sendo falha de verdade.
  await assert.rejects(
    () => seNovo(Promise.reject(new Error("AccessDenied"))),
    /AccessDenied/,
  );
});

test("FAILED distingue regressão de domínio que nunca autenticou", () => {
  assert.deepEqual(domainLabel({ status: "FAILED", verifiedAt: null }), [
    "Falhou",
    "bad",
  ]);
  assert.deepEqual(
    domainLabel({ status: "FAILED", verifiedAt: new Date() }),
    ["Parou de autenticar", "bad"],
    "já esteve verificado: parou de funcionar, não nasceu quebrado",
  );
  assert.deepEqual(
    domainLabel({ status: "VERIFIED", verifiedAt: new Date() }),
    ["Verificado", "ok"],
  );
});

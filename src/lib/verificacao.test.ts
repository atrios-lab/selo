import assert from "node:assert/strict";
import test from "node:test";
import type { CheckedRecord } from "./dns.ts";
import { proximoStatus } from "./verificacao.ts";

const ok = (): CheckedRecord => ({
  type: "CNAME",
  name: "x._domainkey.acme.com.br",
  value: "x.dkim.amazonses.com",
  state: "ok",
});

const ausente = (): CheckedRecord => ({ ...ok(), state: "wait" });
const divergente = (): CheckedRecord => ({
  ...ok(),
  state: "bad",
  found: "y.dkim.amazonses.com",
});
const semResposta = (): CheckedRecord => ({
  ...ok(),
  state: "wait",
  inconclusive: true,
});

test("segue o SES enquanto ele não verificou", () => {
  for (const ses of ["PENDING", "VERIFYING", "FAILED"] as const) {
    assert.equal(proximoStatus({ ses, registros: [ok(), ok()] }), ses);
  }
});

test("verificado com DNS batendo continua VERIFIED", () => {
  assert.equal(
    proximoStatus({ ses: "VERIFIED", registros: [ok(), ok(), ok()] }),
    "VERIFIED",
  );
});

test("regressão: registro sumiu do DNS rebaixa o domínio", () => {
  assert.equal(
    proximoStatus({ ses: "VERIFIED", registros: [ok(), ausente()] }),
    "FAILED",
  );
  assert.equal(
    proximoStatus({ ses: "VERIFIED", registros: [ok(), divergente()] }),
    "FAILED",
  );
});

test("timeout de resolver não rebaixa domínio saudável", () => {
  assert.equal(
    proximoStatus({ ses: "VERIFIED", registros: [ok(), semResposta()] }),
    "VERIFIED",
    "falha de rede não é prova de que o registro sumiu",
  );
  assert.equal(
    proximoStatus({
      ses: "VERIFIED",
      registros: [semResposta(), semResposta(), semResposta()],
    }),
    "VERIFIED",
    "DNS inteiro inacessível preserva o estado anterior",
  );
});

test("evidência conclusiva vence mesmo com outro registro inconclusivo", () => {
  assert.equal(
    proximoStatus({ ses: "VERIFIED", registros: [semResposta(), ausente()] }),
    "FAILED",
  );
});

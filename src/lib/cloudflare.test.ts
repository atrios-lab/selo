import assert from "node:assert/strict";
import test from "node:test";
import { decidirAcao, partesMx, type RegistroCF } from "./cloudflare.ts";
import type { DnsRecord } from "./dns.ts";

const cname: DnsRecord = {
  type: "CNAME",
  name: "tok1._domainkey.acme.com.br",
  value: "tok1.dkim.amazonses.com",
};

const mx: DnsRecord = {
  type: "MX",
  name: "mail.acme.com.br",
  value: "10 feedback-smtp.us-east-1.amazonses.com",
};

const txt: DnsRecord = {
  type: "TXT",
  name: "mail.acme.com.br",
  value: "v=spf1 include:amazonses.com ~all",
};

const cf = (r: Partial<RegistroCF>): RegistroCF => ({
  id: "rec1",
  type: "CNAME",
  name: "tok1._domainkey.acme.com.br",
  content: "tok1.dkim.amazonses.com",
  ...r,
});

test("zona vazia: cria", () => {
  assert.deepEqual(decidirAcao(cname, []), { tipo: "criar" });
});

test("já publicado com o valor certo: não mexe", () => {
  assert.deepEqual(decidirAcao(cname, [cf({})]), { tipo: "nada" });
});

test("ponto final e maiúsculas não contam como diferença", () => {
  const encontrado = cf({
    name: "TOK1._domainkey.acme.com.br.",
    content: "Tok1.dkim.amazonses.com.",
  });
  assert.deepEqual(
    decidirAcao(cname, [encontrado]),
    { tipo: "nada" },
    "corrigir aqui seria escrita à toa em DNS de cliente",
  );
});

test("valor divergente: corrige o existente em vez de duplicar", () => {
  const encontrado = cf({ id: "rec9", content: "outro.dkim.amazonses.com" });
  assert.deepEqual(decidirAcao(cname, [encontrado]), {
    tipo: "corrigir",
    id: "rec9",
  });
});

test("registro de outro tipo no mesmo nome é ignorado", () => {
  const outro = cf({ type: "TXT", content: "sei la" });
  assert.deepEqual(decidirAcao(cname, [outro]), { tipo: "criar" });
});

test("MX compara host e prioridade", () => {
  const certo = cf({
    type: "MX",
    name: "mail.acme.com.br",
    content: "feedback-smtp.us-east-1.amazonses.com",
    priority: 10,
  });
  assert.deepEqual(decidirAcao(mx, [certo]), { tipo: "nada" });

  const prioridadeErrada = { ...certo, id: "rec7", priority: 20 };
  assert.deepEqual(decidirAcao(mx, [prioridadeErrada]), {
    tipo: "corrigir",
    id: "rec7",
  });
});

test("TXT entre aspas é o mesmo TXT", () => {
  const entreAspas = cf({
    type: "TXT",
    name: "mail.acme.com.br",
    content: '"v=spf1 include:amazonses.com ~all"',
  });
  assert.deepEqual(decidirAcao(txt, [entreAspas]), { tipo: "nada" });
});

test("partesMx separa prioridade do host", () => {
  assert.deepEqual(partesMx("10 feedback-smtp.us-east-1.amazonses.com"), {
    priority: 10,
    content: "feedback-smtp.us-east-1.amazonses.com",
  });
});

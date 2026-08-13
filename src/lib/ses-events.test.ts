import assert from "node:assert/strict";
import test from "node:test";
import { classifySesEvent } from "./ses-events.ts";

test("bounce permanente suprime e marca BOUNCED", () => {
  const action = classifySesEvent({
    eventType: "Bounce",
    mail: { messageId: "abc" },
    bounce: {
      bounceType: "Permanent",
      bounceSubType: "General",
      bouncedRecipients: [
        {
          emailAddress: "Sumido@ACME.com.br",
          diagnosticCode: "550 no such user",
        },
      ],
    },
  });

  assert.equal(action?.status, "BOUNCED");
  assert.deepEqual(action?.suppress, [
    { address: "sumido@acme.com.br", reason: "HARD_BOUNCE" },
  ]);
});

test("bounce transiente não suprime nem mexe no status", () => {
  const action = classifySesEvent({
    eventType: "Bounce",
    mail: { messageId: "abc" },
    bounce: {
      bounceType: "Transient",
      bounceSubType: "MailboxFull",
      bouncedRecipients: [{ emailAddress: "cheio@acme.com.br" }],
    },
  });

  assert.equal(action?.status, undefined, "o SES ainda vai re-tentar sozinho");
  assert.deepEqual(
    action?.suppress,
    [],
    "suprimir aqui queimaria endereço válido",
  );
});

test("complaint suprime e marca COMPLAINED", () => {
  const action = classifySesEvent({
    eventType: "Complaint",
    mail: { messageId: "abc" },
    complaint: {
      complainedRecipients: [{ emailAddress: "irritado@acme.com.br" }],
      complaintFeedbackType: "abuse",
    },
  });

  assert.equal(action?.status, "COMPLAINED");
  assert.deepEqual(action?.suppress, [
    { address: "irritado@acme.com.br", reason: "COMPLAINT" },
  ]);
});

test("delivery marca DELIVERED com o timestamp do evento", () => {
  const action = classifySesEvent({
    eventType: "Delivery",
    mail: { messageId: "abc" },
    delivery: { timestamp: "2026-08-13T03:20:58.000Z" },
  });

  assert.equal(action?.status, "DELIVERED");
  assert.equal(action?.deliveredAt?.toISOString(), "2026-08-13T03:20:58.000Z");
  assert.deepEqual(action?.suppress, []);
});

test("notificationType legado é aceito igual ao eventType", () => {
  const action = classifySesEvent({
    notificationType: "Complaint",
    mail: { messageId: "abc" },
    complaint: { complainedRecipients: [{ emailAddress: "x@acme.com.br" }] },
  });

  assert.equal(action?.status, "COMPLAINED");
});

test("eventos fora do escopo do v1 são ignorados", () => {
  for (const eventType of ["Send", "Open", "Click", "DeliveryDelay"]) {
    assert.equal(classifySesEvent({ eventType, mail: {} }), null, eventType);
  }
});

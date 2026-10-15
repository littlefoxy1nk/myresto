import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { sendMail } from "./mailer";

/// Un faux serveur SMTP minimal (EHLO, AUTH, MAIL, RCPT, DATA, QUIT) qui garde ce qu'il reçoit.
function startFakeSmtp(): Promise<{ port: number; received: { auth: string[]; data: string; rcpt: string[] }; close: () => void }> {
  const received = { auth: [] as string[], data: "", rcpt: [] as string[] };
  const server = net.createServer((socket) => {
    let inData = false;
    let buffer = "";
    let authStep: "none" | "plain" | "user" | "pass" = "none";
    socket.write("220 fake ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (inData) {
        if (buffer.includes("\r\n.\r\n")) {
          received.data = buffer.slice(0, buffer.indexOf("\r\n.\r\n"));
          buffer = "";
          inData = false;
          socket.write("250 OK queued\r\n");
        }
        return;
      }
      let idx: number;
      while ((idx = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (authStep === "plain") {
          received.auth.push(Buffer.from(line, "base64").toString());
          authStep = "none";
          socket.write("235 OK\r\n");
        } else if (authStep === "user") {
          received.auth.push(Buffer.from(line, "base64").toString());
          authStep = "pass";
          socket.write("334 UGFzc3dvcmQ6\r\n");
        } else if (authStep === "pass") {
          received.auth.push(Buffer.from(line, "base64").toString());
          authStep = "none";
          socket.write("235 OK\r\n");
        } else if (/^EHLO|^HELO/i.test(line)) socket.write("250-fake\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (/^AUTH PLAIN /i.test(line)) {
          received.auth.push(Buffer.from(line.slice(11), "base64").toString());
          socket.write("235 OK\r\n");
        } else if (/^AUTH PLAIN/i.test(line)) {
          authStep = "plain";
          socket.write("334 \r\n");
        } else if (/^AUTH LOGIN/i.test(line)) {
          authStep = "user";
          socket.write("334 VXNlcm5hbWU6\r\n");
        } else if (/^MAIL FROM/i.test(line)) socket.write("250 OK\r\n");
        else if (/^RCPT TO/i.test(line)) {
          received.rcpt.push(line);
          socket.write("250 OK\r\n");
        } else if (/^DATA/i.test(line)) {
          inData = true;
          socket.write("354 go\r\n");
          if (buffer) socket.emit("data", Buffer.alloc(0));
        } else if (/^QUIT/i.test(line)) {
          socket.write("221 bye\r\n");
          socket.end();
        } else socket.write("250 OK\r\n");
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as net.AddressInfo;
      resolve({ port, received, close: () => server.close() });
    });
  });
}

test("sendMail : le message arrive au serveur SMTP avec objet, destinataire et texte", async () => {
  const smtp = await startFakeSmtp();
  try {
    await sendMail(
      { host: "127.0.0.1", port: smtp.port, secure: false, user: "support@x.be", pass: "secret", from: "support@x.be" },
      { to: "chloehamoir@gmail.com", subject: "[MYRESTO] Test — éàù", text: "Bonjour,\nceci est un test.", replyTo: "marc@x.be" }
    );
  } finally {
    smtp.close();
  }
  assert.ok(smtp.received.rcpt.some((r) => r.includes("chloehamoir@gmail.com")));
  assert.match(smtp.received.data, /Subject: /);
  assert.match(smtp.received.data, /Reply-To: marc@x\.be/);
  assert.match(smtp.received.data, /ceci est un test/);
});

test("sendMail : une erreur de connexion est levée (jamais avalée)", async () => {
  await assert.rejects(
    sendMail(
      { host: "127.0.0.1", port: 1, secure: false, user: "u", pass: "p", from: "u" },
      { to: "a@b.be", subject: "x", text: "y" }
    )
  );
});

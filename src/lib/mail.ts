import "server-only";
import nodemailer from "nodemailer";

// SMTP config from env. Outlook/Microsoft 365: host smtp.office365.com, port 587.
// Set SMTP_USER (e.g. alex.smith@opelsoft.com) + SMTP_PASS (app password) in .env.local.
const host = process.env.SMTP_HOST ?? "smtp.office365.com";
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.SMTP_FROM ?? user;

let transport: nodemailer.Transporter | null = null;
function getTransport() {
  if (!user || !pass) return null; // not configured -> mailer is a no-op
  if (!transport) {
    transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 587 uses STARTTLS
      auth: { user, pass },
    });
  }
  return transport;
}

// Fire-and-forget: never throw into the caller — a failed email must not fail the task.
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const t = getTransport();
  if (!t) {
    console.warn("[mail] SMTP not configured (SMTP_USER/SMTP_PASS); skipping email to", opts.to);
    return;
  }
  try {
    await t.sendMail({ from, ...opts });
  } catch (e) {
    console.error("[mail] send failed:", e);
  }
}

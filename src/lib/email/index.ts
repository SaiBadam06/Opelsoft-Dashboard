import type { EmailSender } from "./types";
import { GraphSender } from "./graph";

let instance: EmailSender | null = null;

/** The one swap point. Phase 2: add AcsSender and switch on EMAIL_SENDER_BACKEND. */
export function getSender(): EmailSender {
  if (instance) return instance;
  const backend = process.env.EMAIL_SENDER_BACKEND ?? "graph";
  switch (backend) {
    case "graph":
      instance = new GraphSender();
      return instance;
    default:
      throw new Error(`Unknown EMAIL_SENDER_BACKEND: ${backend}`);
  }
}
export type { EmailSender, OutboundEmail } from "./types";

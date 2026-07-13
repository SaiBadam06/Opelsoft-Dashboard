export type OutboundEmail = {
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
  /** Header name → value. List-* headers are delivered via Graph extended properties. */
  headers?: Record<string, string>;
};

export interface EmailSender {
  /** Sends one message. Resolves with a provider id, or throws (err.status carries any HTTP code). */
  send(msg: OutboundEmail): Promise<{ id: string }>;
}

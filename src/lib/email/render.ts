import type { OutboundEmail } from "./types";

const ADDRESS = "OpelSoft LLC, 255 Old New Brunswick Road, Suite N210, Piscataway, NJ 08854";

export function applyMergeFields(
  template: string,
  data: Record<string, string | null | undefined>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = data[key];
    return v == null ? "" : String(v);
  });
}

export function unsubscribeUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/unsubscribe?token=${token}`;
}

export function withFooter(bodyHtml: string, unsubUrl: string): string {
  const footer = `
<hr style="border:none;border-top:1px solid #ddd;margin-top:20px">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#777;margin-top:8px">
  ${ADDRESS}<br>
  You're receiving this as a vendor contact of OpelSoft.
  <a href="${unsubUrl}">Unsubscribe</a>.
</div>`;
  return `${bodyHtml}\n${footer}`;
}

export function buildOutbound(opts: {
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  bodyTemplate: string;
  mergeData: Record<string, string | null | undefined>;
  unsubUrl: string;
}): OutboundEmail {
  const html = withFooter(applyMergeFields(opts.bodyTemplate, opts.mergeData), opts.unsubUrl);
  return {
    from: opts.from,
    replyTo: opts.replyTo,
    to: opts.to,
    subject: applyMergeFields(opts.subject, opts.mergeData),
    html,
    headers: {
      "List-Unsubscribe": `<${opts.unsubUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

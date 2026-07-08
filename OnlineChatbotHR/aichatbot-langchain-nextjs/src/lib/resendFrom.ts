const DEFAULT_SENDER_EMAIL = "onboarding@resend.dev";
const DEFAULT_SENDER_NAME = "HR System";

function extractEmail(raw: string): string {
  const angle = raw.match(/<([^>]+)>/);
  return (angle ? angle[1] : raw).trim();
}

export function resolveResendFromAddress(raw: string | undefined): string {
  const trimmed = raw?.trim();
  const emailOnly = trimmed ? extractEmail(trimmed) : "";
  const lower = emailOnly.toLowerCase();

  let addr = DEFAULT_SENDER_EMAIL;
  if (!trimmed) {
    addr = DEFAULT_SENDER_EMAIL;
  } else if (lower.endsWith("@gmail.com") || lower.endsWith("@googlemail.com")) {
    console.warn(
      "[resend] Gmail cannot be used as sender; using onboarding@resend.dev"
    );
    addr = DEFAULT_SENDER_EMAIL;
  } else {
    addr = emailOnly;
  }

  const displayName =
    process.env.RESEND_FROM_NAME?.trim() || DEFAULT_SENDER_NAME;
  return `${displayName} <${addr}>`;
}

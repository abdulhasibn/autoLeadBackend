/**
 * Configures Supabase Auth email for the password reset flow:
 *   - custom SMTP (Gmail by default), which unlocks template editing and
 *     lifts the built-in mailer's tiny send limit;
 *   - the recovery template, so the email carries a 6-digit code
 *     ({{ .Token }}) for POST /auth/reset-password instead of a link;
 *   - Auth rate limits. Every request reaches Supabase from this API's IPs,
 *     so all staff share one per-IP bucket and the defaults are too low.
 *
 * Usage: pnpm auth:configure-email   (reads .env)
 *
 * Required:
 *   SUPABASE_ACCESS_TOKEN  — personal access token (dashboard → Account → Access Tokens)
 *   SMTP_PASS              — Gmail App Password (never commit it)
 *   SMTP_ADMIN_EMAIL       — sender address, e.g. the Gmail account itself
 *
 * Optional:
 *   SUPABASE_PROJECT_REF   — defaults to pptljtbxqzmjossuamve (autolead)
 *   SMTP_HOST              — default smtp.gmail.com
 *   SMTP_PORT              — default 587
 *   SMTP_USER              — default SMTP_ADMIN_EMAIL
 *   SMTP_SENDER_NAME       — default AutoLead
 */

import { run } from './lib/supabase';

/** The subset of the Management API auth config this script sets and prints. */
interface AuthEmailConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_admin_email: string;
  smtp_sender_name: string;
  mailer_otp_length: number;
  mailer_otp_exp: number;
  mailer_subjects_recovery: string;
  mailer_templates_recovery_content: string;
  rate_limit_email_sent: number;
  rate_limit_verify: number;
  rate_limit_token_refresh: number;
  smtp_max_frequency: number;
}

const RECOVERY_BODY = `<h2>Reset your AutoLead password</h2>
<p>Enter this code in the app to choose a new password. It expires in 15 minutes and works once.</p>
<p style="font-size:24px;letter-spacing:4px;font-weight:700;">{{ .Token }}</p>
<p>If you did not ask to reset your password, ignore this email. Your password has not changed.</p>`;

function requiredEnv(): { accessToken: string; smtpPass: string; smtpAdminEmail: string } {
  const required = ['SUPABASE_ACCESS_TOKEN', 'SMTP_PASS', 'SMTP_ADMIN_EMAIL'] as const;
  const missing = required.filter((name) => (process.env[name] ?? '').trim() === '');
  if (missing.length > 0) {
    console.error(`Missing required env: ${missing.join(', ')}`);
    process.exit(1);
  }
  return {
    accessToken: process.env.SUPABASE_ACCESS_TOKEN as string,
    smtpPass: process.env.SMTP_PASS as string,
    smtpAdminEmail: process.env.SMTP_ADMIN_EMAIL as string,
  };
}

async function main(): Promise<void> {
  const projectRef = process.env.SUPABASE_PROJECT_REF ?? 'pptljtbxqzmjossuamve';
  const { accessToken, smtpPass, smtpAdminEmail } = requiredEnv();

  const body: AuthEmailConfig = {
    smtp_host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    smtp_port: String(process.env.SMTP_PORT ?? '587'),
    smtp_user: process.env.SMTP_USER ?? smtpAdminEmail,
    smtp_pass: smtpPass,
    smtp_admin_email: smtpAdminEmail,
    smtp_sender_name: process.env.SMTP_SENDER_NAME ?? 'AutoLead',
    // Must match ResetCode (6 digits). Expiry applies to every email OTP type.
    mailer_otp_length: 6,
    mailer_otp_exp: 900,
    mailer_subjects_recovery: 'Your AutoLead password reset code is {{ .Token }}',
    mailer_templates_recovery_content: RECOVERY_BODY,
    rate_limit_email_sent: 100,
    rate_limit_verify: 120,
    rate_limit_token_refresh: 1800,
    // Minimum seconds between two emails to the same address.
    smtp_max_frequency: 60,
  };

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`Auth email configuration failed (${response.status})`);
    console.error(text);
    process.exit(1);
  }

  const applied = JSON.parse(text) as AuthEmailConfig;
  console.log('Auth email configuration applied.');
  console.log(`project_ref=${projectRef}`);
  console.log(`smtp_host=${applied.smtp_host}:${applied.smtp_port}`);
  console.log(`smtp_admin_email=${applied.smtp_admin_email}`);
  console.log(`recovery_subject=${applied.mailer_subjects_recovery}`);
  console.log(`mailer_otp_length=${applied.mailer_otp_length}`);
  console.log(`mailer_otp_exp=${applied.mailer_otp_exp}s`);
  console.log(`rate_limit_email_sent=${applied.rate_limit_email_sent}`);
  console.log(`rate_limit_verify=${applied.rate_limit_verify}`);
  console.log(`rate_limit_token_refresh=${applied.rate_limit_token_refresh}`);
  console.log(`smtp_max_frequency=${applied.smtp_max_frequency}s`);
}

run(main);

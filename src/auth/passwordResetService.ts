import { findUserByIdentifier, updateUserPassword } from './authStorage';

export type ResetDeliveryChannel = 'emailjs' | 'supabase' | 'local-preview';

export interface PasswordResetRequestResult {
  ok: boolean;
  channel: ResetDeliveryChannel;
  recipientEmail?: string;
  previewCode?: string;
  message: string;
}

export interface PasswordResetVerifyResult {
  ok: boolean;
  message: string;
}

interface StoredOtpRecord {
  identifier: string;
  email: string;
  code: string;
  expiresAt: number;
}

const OTP_STORAGE_KEY = 'mineiro_password_reset_otp_v1';
const OTP_TTL_MS = 15 * 60 * 1000;

function generateSixDigitCode(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(100000 + (buf[0] % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

function saveOtpRecord(record: StoredOtpRecord): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(record));
    }
  } catch {
    // Ignore storage quota errors
  }
}

function loadOtpRecord(): StoredOtpRecord | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(OTP_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StoredOtpRecord;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function clearOtpRecord(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(OTP_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

/**
 * Sends a 6-digit password reset code via free EmailJS (when configured in .env),
 * or Supabase Auth OTP when connected to a database, falling back to a local
 * verifiable 6-digit preview code when no external provider keys are set yet.
 */
export async function requestPasswordResetCode(
  identifier: string
): Promise<PasswordResetRequestResult> {
  const user = findUserByIdentifier(identifier);
  if (!user) {
    return {
      ok: false,
      channel: 'local-preview',
      message: 'Nenhuma conta encontrada para este e-mail ou usuário.',
    };
  }

  const code = generateSixDigitCode();
  const expiresAt = Date.now() + OTP_TTL_MS;
  saveOtpRecord({
    identifier: user.username,
    email: user.email,
    code,
    expiresAt,
  });

  const emailjsServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
  const emailjsTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
  const emailjsPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

  if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey) {
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: emailjsServiceId,
          template_id: emailjsTemplateId,
          user_id: emailjsPublicKey,
          template_params: {
            to_email: user.email,
            to_name: user.name,
            reset_code: code,
            app_name: 'MINEIRØ',
          },
        }),
      });
      if (res.ok) {
        return {
          ok: true,
          channel: 'emailjs',
          recipientEmail: user.email,
          message: `Código de 6 dígitos enviado gratuitamente para ${user.email}.`,
        };
      }
    } catch {
      // Fall through to local preview if offline or misconfigured
    }
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ email: user.email }),
      });
      if (res.ok) {
        return {
          ok: true,
          channel: 'supabase',
          recipientEmail: user.email,
          message: `Código/link de recuperação enviado via Supabase para ${user.email}.`,
        };
      }
    } catch {
      // Fall through to local preview if offline
    }
  }

  return {
    ok: true,
    channel: 'local-preview',
    recipientEmail: user.email,
    previewCode: code,
    message: `Modo local (sem chave de e-mail no .env): use o código ${code} para redefinir a senha de ${user.email}.`,
  };
}

export function verifyResetCodeAndUpdatePassword(
  codeInput: string,
  newPassword: string
): PasswordResetVerifyResult {
  const record = loadOtpRecord();
  if (!record) {
    return {
      ok: false,
      message: 'Nenhum código ativo encontrado. Solicite um novo código.',
    };
  }

  if (Date.now() > record.expiresAt) {
    clearOtpRecord();
    return {
      ok: false,
      message: 'Este código expirou. Solicite um novo código.',
    };
  }

  if (codeInput.trim() !== record.code) {
    return {
      ok: false,
      message: 'Código inválido. Confira os 6 dígitos e tente novamente.',
    };
  }

  if (newPassword.length < 5) {
    return {
      ok: false,
      message: 'A nova senha deve ter pelo menos 5 caracteres.',
    };
  }

  const updated = updateUserPassword(record.identifier, newPassword);
  if (!updated) {
    return {
      ok: false,
      message: 'Não foi possível atualizar a senha desta conta.',
    };
  }

  clearOtpRecord();
  return {
    ok: true,
    message: 'Senha alterada com sucesso! Agora você já pode entrar com a nova senha.',
  };
}

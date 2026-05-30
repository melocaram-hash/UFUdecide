import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  isValidUFUEmail,
  hashEmail,
  generateCode,
  checkRateLimit,
  getClientIP,
  getSupabaseAdmin,
} from '@/lib/utils'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email: string = (body.email ?? '').trim()

    // 1. Validate UFU domain
    if (!isValidUFUEmail(email)) {
      return NextResponse.json(
        { error: 'E-mail inválido. Use seu e-mail institucional @ufu.br.' },
        { status: 400 },
      )
    }

    // 2. Rate limit — 3 requests per IP per 15 minutes
    const ip = getClientIP(request)
    const allowed = await checkRateLimit(ip, 'send-code', 3, 15)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.' },
        { status: 429 },
      )
    }

    const supabase = getSupabaseAdmin()
    const emailHash = await hashEmail(email)

    // 3. Check if this email already voted
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id')
      .eq('email_hash', emailHash)
      .maybeSingle()

    if (existingVote) {
      return NextResponse.json(
        { error: 'Este e-mail já registrou um voto.' },
        { status: 409 },
      )
    }

    // 4. Invalidate previous unused codes for this email
    await supabase
      .from('verification_codes')
      .update({ used: true })
      .eq('email_hash', emailHash)
      .eq('used', false)

    // 5. Generate code with 10-minute expiry
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase.from('verification_codes').insert({
      email_hash: emailHash,
      code,
      expires_at: expiresAt,
    })

    if (insertError) {
      console.error('[send-code] insert error:', insertError.message)
      return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
    }

    // 6. Send email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'UFU Decide <noreply@ufudecide.com.br>',
      to: email,
      subject: 'Seu código de verificação — UFU Decide',
      html: buildEmailHtml(code),
    })

    if (emailError) {
      console.error('[send-code] resend error:', emailError)
      return NextResponse.json(
        { error: 'Não foi possível enviar o e-mail. Tente novamente.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[send-code] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

function buildEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Código de Verificação — UFU Decide</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#003087;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">UFU Decide</h1>
              <p style="margin:4px 0 0;color:#ccd9f0;font-size:13px;">Votação Estudantil</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 24px;color:#1a1a1a;font-size:16px;line-height:1.6;">
                Olá! Use o código abaixo para confirmar seu e-mail e registrar seu voto:
              </p>

              <!-- Code block -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:#f0f4ff;border:2px solid #003087;border-radius:10px;padding:20px 40px;text-align:center;">
                      <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#003087;font-family:'Courier New',monospace;">${code}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;color:#555;font-size:14px;line-height:1.6;">
                Este código é válido por <strong>10 minutos</strong>. Não compartilhe com ninguém.
              </p>
              <p style="margin:12px 0 0;color:#888;font-size:13px;line-height:1.6;">
                Se você não solicitou este código, ignore este e-mail — nenhuma ação será necessária.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:20px 40px;border-top:1px solid #eee;text-align:center;">
              <p style="margin:0;color:#aaa;font-size:12px;">
                UFU Decide · Universidade Federal de Uberlândia
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

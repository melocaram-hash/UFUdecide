import { NextRequest, NextResponse } from 'next/server'
import { isValidUFUEmail, hashEmail, getSupabaseAdmin } from '@/lib/utils'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const MAX_ATTEMPTS = 5

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email: string = (body.email ?? '').trim()
    const code: string = (body.code ?? '').trim()

    // 1. Validate UFU domain
    if (!isValidUFUEmail(email)) {
      return NextResponse.json(
        { error: 'E-mail inválido. Use seu e-mail institucional @ufu.br.' },
        { status: 400 },
      )
    }

    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Código inválido.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const emailHash = await hashEmail(email)
    const now = new Date().toISOString()

    // 2. Find the most recent valid (unused, not expired) code for this email
    const { data: record, error: fetchError } = await supabase
      .from('verification_codes')
      .select('id, code, attempts, expires_at')
      .eq('email_hash', emailHash)
      .eq('used', false)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      console.error('[verify-code] fetch error:', fetchError.message)
      return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
    }

    if (!record) {
      return NextResponse.json(
        { error: 'Nenhum código válido encontrado. Solicite um novo código.' },
        { status: 404 },
      )
    }

    // 3. Check attempt count before validating
    if (record.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Número máximo de tentativas atingido. Solicite um novo código.' },
        { status: 429 },
      )
    }

    // 4. Increment attempt counter
    await supabase
      .from('verification_codes')
      .update({ attempts: record.attempts + 1 })
      .eq('id', record.id)

    // 5. Validate the code
    if (record.code !== code) {
      const remaining = MAX_ATTEMPTS - (record.attempts + 1)
      return NextResponse.json(
        {
          error:
            remaining > 0
              ? `Código incorreto. Você tem ${remaining} tentativa(s) restante(s).`
              : 'Código incorreto. Número máximo de tentativas atingido.',
        },
        { status: 401 },
      )
    }

    // 6. Mark as used and store a temporary session token
    const verifiedToken = randomUUID()

    const { error: updateError } = await supabase
      .from('verification_codes')
      .update({ used: true, verified_token: verifiedToken })
      .eq('id', record.id)

    if (updateError) {
      console.error('[verify-code] update error:', updateError.message)
      return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, token: verifiedToken })
  } catch (err) {
    console.error('[verify-code] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

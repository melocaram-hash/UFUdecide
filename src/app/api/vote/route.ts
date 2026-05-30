import { NextRequest, NextResponse } from 'next/server'
import { isValidUFUEmail, hashEmail, getSupabaseAdmin } from '@/lib/utils'

const VALID_CHOICES = ['favor', 'contra', 'abstencao'] as const
type Choice = (typeof VALID_CHOICES)[number]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email: string = (body.email ?? '').trim()
    const token: string = (body.token ?? '').trim()
    const choice: string = (body.choice ?? '').trim()

    // 1. Validate UFU domain
    if (!isValidUFUEmail(email)) {
      return NextResponse.json(
        { error: 'E-mail inválido. Use seu e-mail institucional @ufu.br.' },
        { status: 400 },
      )
    }

    // 2. Validate choice value
    if (!VALID_CHOICES.includes(choice as Choice)) {
      return NextResponse.json(
        { error: 'Opção de voto inválida. Escolha: favor, contra ou abstencao.' },
        { status: 400 },
      )
    }

    if (!token) {
      return NextResponse.json({ error: 'Token de sessão ausente.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const emailHash = await hashEmail(email)
    const now = new Date().toISOString()

    // 3. Validate session token — must match email_hash, be used (verified) and not expired
    const { data: session, error: sessionError } = await supabase
      .from('verification_codes')
      .select('id, expires_at')
      .eq('email_hash', emailHash)
      .eq('verified_token', token)
      .eq('used', true)
      .gt('expires_at', now)
      .maybeSingle()

    if (sessionError) {
      console.error('[vote] session fetch error:', sessionError.message)
      return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Sessão inválida ou expirada. Por favor, verifique seu e-mail novamente.' },
        { status: 401 },
      )
    }

    // 4. Check if this email already voted
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

    // 5. Insert vote
    const { error: insertError } = await supabase.from('votes').insert({
      email_hash: emailHash,
      choice,
    })

    if (insertError) {
      console.error('[vote] insert error:', insertError.message)
      return NextResponse.json({ error: 'Erro ao registrar voto. Tente novamente.' }, { status: 500 })
    }

    // 6. Consume the session token (prevent reuse)
    await supabase
      .from('verification_codes')
      .update({ verified_token: null })
      .eq('id', session.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[vote] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

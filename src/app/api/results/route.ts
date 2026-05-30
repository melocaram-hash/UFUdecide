import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/utils'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('public_results')
      .select('favor, contra, abstencao, total')
      .maybeSingle()

    if (error) {
      console.error('[results] query error:', error.message)
      return NextResponse.json({ error: 'Erro ao buscar resultados.' }, { status: 500 })
    }

    const results = data ?? { favor: 0, contra: 0, abstencao: 0, total: 0 }

    return NextResponse.json(
      {
        favor: Number(results.favor),
        contra: Number(results.contra),
        abstencao: Number(results.abstencao),
        total: Number(results.total),
      },
      {
        headers: {
          // Allow public caching for up to 30 seconds
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    )
  } catch (err) {
    console.error('[results] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

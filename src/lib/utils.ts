import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// ────────────────────────────────────────────────────────────
// Email
// ────────────────────────────────────────────────────────────

export function isValidUFUEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+\-]+@ufu\.br$/i.test(email.trim())
}

export async function hashEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase()
  const encoded = new TextEncoder().encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ────────────────────────────────────────────────────────────
// Code generation
// ────────────────────────────────────────────────────────────

export function generateCode(): string {
  // Cryptographically random 6-digit code
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return String(array[0] % 1_000_000).padStart(6, '0')
}

// ────────────────────────────────────────────────────────────
// IP extraction
// ────────────────────────────────────────────────────────────

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') ?? '0.0.0.0'
}

// ────────────────────────────────────────────────────────────
// Supabase admin client (service role — bypasses RLS)
// ────────────────────────────────────────────────────────────

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase environment variables are not configured')
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

// ────────────────────────────────────────────────────────────
// Rate limiting
// ────────────────────────────────────────────────────────────

/**
 * Returns true if the request is within limits (allowed to proceed).
 * Inserts a new record on every call.
 */
export async function checkRateLimit(
  ip: string,
  action: string,
  maxAttempts: number,
  windowMinutes: number,
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  const { count, error } = await supabase
    .from('rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('action', action)
    .gte('created_at', since)

  if (error) {
    // On DB error, allow the request to avoid hard blocks on all users
    console.error('[rate_limit] select error:', error.message)
    return true
  }

  if ((count ?? 0) >= maxAttempts) {
    return false
  }

  // Record this attempt
  await supabase.from('rate_limits').insert({ ip, action })
  return true
}

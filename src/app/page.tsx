'use client'

import { useState } from 'react'

type Step = 'email' | 'code' | 'vote' | 'done'

interface Results {
  favor: number
  contra: number
  abstencao: number
  total: number
}

export default function Home() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [choice, setChoice] = useState<'favor' | 'contra' | 'abstencao' | ''>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Results | null>(null)

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setStep('code')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setToken(data.token)
      setStep('vote')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVote() {
    if (!choice) { setError('Selecione uma opção antes de votar.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, choice }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }

      // Fetch results
      const resResults = await fetch('/api/results')
      const resultData = await resResults.json()
      setResults(resultData)
      setStep('done')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const pct = (n: number) =>
    results && results.total > 0 ? Math.round((n / results.total) * 100) : 0

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill="#fff" fillOpacity=".15"/>
              <path d="M8 15l5 5 7-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={styles.logoText}>UFU Decide</span>
          </div>
          <span style={styles.badge}>Votação Estudantil</span>
        </div>
      </header>

      {/* Card */}
      <main style={styles.main}>
        <div style={styles.card}>

          {/* ── STEP: EMAIL ── */}
          {step === 'email' && (
            <>
              <div style={styles.cardHeader}>
                <div style={styles.iconCircle}>✉️</div>
                <h1 style={styles.title}>Registre seu voto</h1>
                <p style={styles.subtitle}>
                  Use seu e-mail institucional <strong>@ufu.br</strong> para participar.
                  Seu endereço nunca será armazenado.
                </p>
              </div>
              <form onSubmit={handleSendCode} style={styles.form}>
                <label style={styles.label}>E-mail institucional</label>
                <input
                  style={styles.input}
                  type="email"
                  placeholder="seu.nome@ufu.br"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                {error && <p style={styles.error}>{error}</p>}
                <button style={styles.btnPrimary} type="submit" disabled={loading}>
                  {loading ? 'Enviando...' : 'Receber código de verificação →'}
                </button>
              </form>
              <p style={styles.hint}>
                Você receberá um código de 6 dígitos por e-mail. Cada endereço pode votar apenas uma vez.
              </p>
            </>
          )}

          {/* ── STEP: CODE ── */}
          {step === 'code' && (
            <>
              <div style={styles.cardHeader}>
                <div style={styles.iconCircle}>🔐</div>
                <h1 style={styles.title}>Verifique seu e-mail</h1>
                <p style={styles.subtitle}>
                  Enviamos um código de 6 dígitos para <strong>{email}</strong>.
                  Válido por 10 minutos.
                </p>
              </div>
              <form onSubmit={handleVerifyCode} style={styles.form}>
                <label style={styles.label}>Código de verificação</label>
                <input
                  style={{ ...styles.input, ...styles.inputCode }}
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                />
                {error && <p style={styles.error}>{error}</p>}
                <button style={styles.btnPrimary} type="submit" disabled={loading}>
                  {loading ? 'Verificando...' : 'Confirmar código →'}
                </button>
                <button
                  type="button"
                  style={styles.btnGhost}
                  onClick={() => { setStep('email'); setError(''); setCode('') }}
                >
                  ← Usar outro e-mail
                </button>
              </form>
            </>
          )}

          {/* ── STEP: VOTE ── */}
          {step === 'vote' && (
            <>
              <div style={styles.cardHeader}>
                <div style={styles.iconCircle}>🗳️</div>
                <h1 style={styles.title}>Registre seu voto</h1>
                <p style={styles.subtitle}>
                  Escolha uma opção abaixo. Este voto é definitivo e não pode ser alterado.
                </p>
              </div>

              <div style={styles.voteOptions}>
                <button
                  style={{ ...styles.voteBtn, ...(choice === 'favor' ? styles.voteBtnFavor : {}) }}
                  onClick={() => setChoice('favor')}
                >
                  <span style={styles.voteIcon}>👍</span>
                  <span style={styles.voteLabel}>A Favor</span>
                </button>
                <button
                  style={{ ...styles.voteBtn, ...(choice === 'contra' ? styles.voteBtnContra : {}) }}
                  onClick={() => setChoice('contra')}
                >
                  <span style={styles.voteIcon}>👎</span>
                  <span style={styles.voteLabel}>Contra</span>
                </button>
                <button
                  style={{ ...styles.voteBtn, ...(choice === 'abstencao' ? styles.voteBtnAbstencao : {}) }}
                  onClick={() => setChoice('abstencao')}
                >
                  <span style={styles.voteIcon}>🤷</span>
                  <span style={styles.voteLabel}>Abstenção</span>
                </button>
              </div>

              {error && <p style={{ ...styles.error, marginTop: 8 }}>{error}</p>}

              <button
                style={{ ...styles.btnPrimary, marginTop: 24, opacity: choice ? 1 : 0.5 }}
                onClick={handleVote}
                disabled={loading || !choice}
              >
                {loading ? 'Registrando...' : 'Confirmar voto →'}
              </button>
            </>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && results && (
            <>
              <div style={styles.cardHeader}>
                <div style={styles.iconCircle}>✅</div>
                <h1 style={styles.title}>Voto registrado!</h1>
                <p style={styles.subtitle}>
                  Obrigado por participar. Confira o placar parcial abaixo.
                </p>
              </div>

              <div style={styles.results}>
                <ResultBar label="A Favor" emoji="👍" count={results.favor} pct={pct(results.favor)} color="#16a34a" />
                <ResultBar label="Contra" emoji="👎" count={results.contra} pct={pct(results.contra)} color="#dc2626" />
                <ResultBar label="Abstenção" emoji="🤷" count={results.abstencao} pct={pct(results.abstencao)} color="#ca8a04" />
              </div>

              <p style={styles.total}>
                Total de votos: <strong>{results.total}</strong>
              </p>
            </>
          )}

        </div>

        {/* Progress dots */}
        <div style={styles.dots}>
          {(['email', 'code', 'vote', 'done'] as Step[]).map((s, i) => (
            <div
              key={s}
              style={{
                ...styles.dot,
                background: ['email', 'code', 'vote', 'done'].indexOf(step) >= i ? '#003087' : '#cbd5e1',
              }}
            />
          ))}
        </div>
      </main>

      <footer style={styles.footer}>
        UFU Decide · Universidade Federal de Uberlândia · Seus dados são protegidos por hash SHA-256
      </footer>
    </div>
  )
}

function ResultBar({ label, emoji, count, pct, color }: {
  label: string; emoji: string; count: number; pct: number; color: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{emoji} {label}</span>
        <span style={{ color: '#64748b', fontSize: 14 }}>{count} voto{count !== 1 ? 's' : ''} · {pct}%</span>
      </div>
      <div style={{ background: '#e2e8f0', borderRadius: 99, height: 10, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 99,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

// ── Inline styles ──────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(135deg, #001f5e 0%, #003087 50%, #0050c8 100%)',
  },
  header: {
    padding: '16px 24px',
  },
  headerInner: {
    maxWidth: 560,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logoText: {
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    letterSpacing: '-0.3px',
  },
  badge: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    padding: '4px 12px',
    borderRadius: 99,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  cardHeader: {
    textAlign: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    fontSize: 40,
    marginBottom: 16,
    display: 'block',
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 10,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 1.6,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    border: '2px solid #e2e8f0',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
  },
  inputCode: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '8px 12px',
  },
  btnPrimary: {
    background: '#003087',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  btnGhost: {
    background: 'transparent',
    color: '#64748b',
    border: 'none',
    borderRadius: 10,
    padding: '10px',
    fontSize: 13,
    cursor: 'pointer',
  },
  hint: {
    marginTop: 16,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  voteOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  voteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '16px 20px',
    border: '2px solid #e2e8f0',
    borderRadius: 12,
    background: '#f8fafc',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontSize: 16,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  voteBtnFavor: {
    borderColor: '#16a34a',
    background: '#f0fdf4',
    color: '#15803d',
  },
  voteBtnContra: {
    borderColor: '#dc2626',
    background: '#fef2f2',
    color: '#b91c1c',
  },
  voteBtnAbstencao: {
    borderColor: '#ca8a04',
    background: '#fefce8',
    color: '#92400e',
  },
  voteIcon: {
    fontSize: 24,
  },
  voteLabel: {
    fontSize: 16,
    fontWeight: 600,
  },
  results: {
    marginTop: 8,
  },
  total: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 14,
    color: '#64748b',
  },
  dots: {
    display: 'flex',
    gap: 8,
    marginTop: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    transition: 'background 0.3s',
  },
  footer: {
    textAlign: 'center',
    padding: '16px',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
  },
}

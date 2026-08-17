import React, { useState } from 'react'
import { Mail, Key, ArrowRight, Check } from 'lucide-react'
import { ApiClient } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

interface AuthViewProps {
  onLoginSuccess: (user: any) => void
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState<string>('')
  const [otp, setOtp] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setIsLoading(true)
    setErrorMsg(null)
    try {
      await ApiClient.sendOtp(email.trim())
      setStep('otp')
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar código de verificação.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp.trim()) return
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const data = await ApiClient.verifyOtp(email.trim(), otp.trim())
      onLoginSuccess(data.user)
    } catch (err: any) {
      setErrorMsg(err.message || 'Código inválido ou expirado.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-main)] flex items-center justify-center p-4 transition-colors">
      <Card className="w-full max-w-md border-[var(--border-main)] bg-[var(--bg-card)] shadow-2xl overflow-hidden">
        <CardHeader className="p-6 text-center border-b border-[var(--border-main)] bg-[var(--bg-card-subtle)]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent-border)] flex items-center justify-center text-xl mx-auto mb-3 shadow-xs">
            ⚡
          </div>
          <CardTitle className="text-xl font-bold text-[var(--text-main)]">
            NanoClaw UAI
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-muted)] mt-1">
            Painel de Operações, Chat Omnichannel & Automações
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {errorMsg && (
            <div className="p-3 mb-4 rounded-lg bg-red-500/15 border border-red-500/30 text-red-500 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                  E-mail Autorizado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="admin@dominio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 gap-2 font-bold text-xs mt-2"
              >
                <span>{isLoading ? 'Enviando Código...' : 'Receber Código de Acesso'}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-main)] mb-1.5">
                  Código de 6 Dígitos
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-[var(--text-dim)] absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-sm font-mono tracking-widest text-[var(--text-input)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-center font-bold"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-[var(--text-dim)] mt-1 text-center font-mono">
                  Enviado para {email}
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 gap-2 font-bold text-xs mt-2"
              >
                <span>{isLoading ? 'Verificando...' : 'Entrar no Painel'}</span>
                <Check className="w-4 h-4" />
              </Button>

              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-center text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text-main)] mt-2 cursor-pointer transition-colors"
              >
                Alterar e-mail
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

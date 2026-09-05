"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth"
import { auth, googleProvider } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import airRoutesJson from "@/data/routes/air.json"
import oceanRoutesJson from "@/data/routes/ocean.json"
import { GlobeRouteAnimation } from "@/lib/globe/types"

// Dynamic import to avoid SSR issues with WebGL
const GlobeScene = dynamic(() => import("@/components/globe/globe-scene").then(mod => ({ default: mod.GlobeScene })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0a1628]">
      <div className="text-sm text-white/50">Loading globe...</div>
    </div>
  ),
})

const airRoutes = airRoutesJson as GlobeRouteAnimation[]
const oceanRoutes = oceanRoutesJson as GlobeRouteAnimation[]

type AuthMode = 'signin' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [mode, setMode] = useState<AuthMode>('signin')
  
  // Form state
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError(null)

      await signInWithPopup(auth, googleProvider)
      // Auth context will handle the redirect
    } catch (err: unknown) {
      setLoading(false)
      
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code
        
        switch (code) {
          case 'auth/popup-closed-by-user':
            setError('Sign-in was cancelled.')
            break
          case 'auth/popup-blocked':
            setError('Popup was blocked. Please allow popups and try again.')
            break
          case 'auth/network-request-failed':
            setError('Network error. Please check your connection.')
            break
          case 'auth/cancelled-popup-request':
            setError(null)
            break
          default:
            setError('Sign-in failed. Please try again.')
        }
      } else {
        setError('An unexpected error occurred.')
      }
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('Please enter email and password.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      await signInWithEmailAndPassword(auth, email, password)
      // Auth context will handle the redirect
    } catch (err: unknown) {
      setLoading(false)
      
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code
        
        switch (code) {
          case 'auth/invalid-email':
            setError('Invalid email address.')
            break
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            setError('Invalid email or password.')
            break
          case 'auth/too-many-requests':
            setError('Too many failed attempts. Please try again later.')
            break
          case 'auth/network-request-failed':
            setError('Network error. Please check your connection.')
            break
          default:
            setError('Sign-in failed. Please try again.')
        }
      } else {
        setError('An unexpected error occurred.')
      }
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      
      // Update profile with display name
      await updateProfile(userCredential.user, {
        displayName: fullName
      })
      
      // Force refresh to get updated profile
      await userCredential.user.reload()
      
      // Auth context will handle the redirect
    } catch (err: unknown) {
      setLoading(false)
      
      // Log full error details in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Signup error details:', err)
      }
      
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code
        
        switch (code) {
          case 'auth/operation-not-allowed':
            setError('Email/password sign-up is currently disabled.')
            break
          case 'auth/invalid-email':
            setError('Please enter a valid email address.')
            break
          case 'auth/email-already-in-use':
            setError('An account with this email already exists.')
            break
          case 'auth/weak-password':
            setError('Password is too weak. Use at least 6 characters.')
            break
          case 'auth/network-request-failed':
            setError('Network error. Please check your connection.')
            break
          default:
            console.error('Unhandled signup error code:', code)
            setError('We couldn\'t create your account. Please try again.')
        }
      } else {
        setError('An unexpected error occurred.')
      }
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-svh w-full flex items-center justify-center bg-[var(--surface)]">
        <div className="text-sm text-[var(--color-on-surface-variant)]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-svh w-full overflow-hidden" style={{ backgroundColor: "var(--surface)" }}>
      {/* Globe - embedded naturally with subtle ambient lighting */}
      <div className="absolute inset-0 hidden lg:flex items-center justify-end pr-[2%]">
        <div className="relative w-[52%] h-full">
          {/* Subtle ambient glow behind globe - blends into same background */}
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none" 
            style={{
              background: "radial-gradient(ellipse 600px 600px at center, rgba(11, 38, 54, 0.25) 0%, transparent 65%)"
            }}
            aria-hidden="true"
          />
          <GlobeScene 
            airRoutes={airRoutes}
            oceanRoutes={oceanRoutes}
            className="w-full h-full"
          />
          {/* Subtle product context */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-center pointer-events-none">
            <p className="text-[15px] font-medium text-[var(--color-on-surface)] mb-1 opacity-80">
              Reconcile across every source.
            </p>
            <p className="text-[12px] text-[var(--color-on-surface-variant)] opacity-60">
              Merchant · Gateway · Bank
            </p>
          </div>
        </div>
      </div>

      {/* Login Card - positioned on same background */}
      <div className="relative z-10 min-h-svh flex items-center justify-start p-6 md:p-12">
        <div 
          className="w-full max-w-[420px] rounded-2xl border p-9 md:p-11 shadow-2xl mx-auto lg:mx-0 lg:ml-[8%]"
          style={{
            backgroundColor: "var(--surface-container)",
            backdropFilter: "blur(20px) saturate(180%)",
            borderColor: "var(--outline-variant)",
          }}
        >
          {/* Brand Identity */}
          <div className="mb-9">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-7 group">
              <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-primary)] shadow-md transition-transform group-hover:scale-105">
                <span className="material-symbols-outlined text-[var(--color-on-primary)]" style={{ fontSize: "26px" }}>
                  account_balance
                </span>
              </div>
              <span className="text-[26px] font-semibold text-[var(--color-on-surface)] tracking-tight">LedgerLens</span>
            </Link>
            
            {mode === 'signin' ? (
              <>
                <h1 className="text-[17px] font-medium text-[var(--color-on-surface)] leading-relaxed mb-2">
                  Financial reconciliation,
                  <br />
                  without guesswork.
                </h1>
                <p className="text-[13px] text-[var(--color-on-surface-variant)] leading-relaxed">
                  Secure access to your reconciliation workspace.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-[19px] font-semibold text-[var(--color-on-surface)] mb-2">
                  Create your LedgerLens account
                </h1>
                <p className="text-[13px] text-[var(--color-on-surface-variant)]">
                  Start reconciling with confidence.
                </p>
              </>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-[13px] text-destructive text-center leading-relaxed">
              {error}
            </div>
          )}

          {/* Auth Form */}
          {mode === 'signin' ? (
            <form onSubmit={handleEmailSignIn} className="space-y-5">
              <FieldGroup>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Password</FieldLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    required
                  />
                </Field>
              </FieldGroup>

              <Button 
                type="submit" 
                className="w-full h-11"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--outline-variant)]" />
                </div>
                <div className="relative flex justify-center text-[12px]">
                  <span className="px-3 bg-[var(--surface-container)] text-[var(--color-on-surface-variant)] font-medium">
                    or
                  </span>
                </div>
              </div>

              {/* Google Sign-In */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="size-5 mr-2.5"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </Button>

              {/* Switch to Sign Up */}
              <FieldDescription className="text-center pt-1">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setError(null)
                    setFullName("")
                    setEmail("")
                    setPassword("")
                    setConfirmPassword("")
                  }}
                  className="text-[var(--color-primary)] hover:underline font-medium"
                >
                  Create account
                </button>
              </FieldDescription>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-5">
              <FieldGroup>
                <Field>
                  <FieldLabel>Full name</FieldLabel>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    autoComplete="name"
                    disabled={loading}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={loading}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Password</FieldLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={loading}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Confirm password</FieldLabel>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={loading}
                    required
                  />
                </Field>
              </FieldGroup>

              <Button 
                type="submit" 
                className="w-full h-11"
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Create account'}
              </Button>

              {/* Switch to Sign In */}
              <FieldDescription className="text-center pt-1">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setError(null)
                    setFullName("")
                    setPassword("")
                    setConfirmPassword("")
                  }}
                  className="text-[var(--color-primary)] hover:underline font-medium"
                >
                  Sign in
                </button>
              </FieldDescription>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { GodRays, MeshGradient } from '@paper-design/shaders-react';
import { BRAND_NAME } from '@/lib/brand';
import { loginWithPassword } from '@/lib/auth';

function SessionNotice() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  if (reason !== 'session-expired') {
    return null;
  }

  return (
    <p className="rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm text-[#0b1f4d] backdrop-blur-md">
      Your session expired. Sign in again to continue.
    </p>
  );
}

function LoginExperience() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = expanded ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [expanded]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    const result = await loginWithPassword(username.trim(), password);

    if (result.ok) {
      router.replace('/dashboard');
      return;
    }

    setError(result.error);
    setSubmitting(false);
  }

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-20">
        {/* GodRays light background */}
        <div className="absolute inset-0">
          <GodRays
            colorBack="#00000000"
            colors={['#FFFFFF6E', '#F3F3F3F0', '#8A8A8A', '#989898']}
            colorBloom="#FFFFFF"
            offsetX={0.85}
            offsetY={-1}
            intensity={1}
            spotty={0.45}
            midSize={10}
            midIntensity={0}
            density={0.12}
            bloom={0.15}
            speed={prefersReducedMotion ? 0 : 1}
            scale={1.6}
            style={{
              height: '100%',
              width: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-4 text-center sm:gap-6">
          <h1 className="max-w-2xl text-4xl font-normal leading-[90%] tracking-[-0.03em] text-black mix-blend-exclusion sm:text-5xl md:text-6xl lg:text-7xl">
            {BRAND_NAME}
          </h1>

          <p className="max-w-2xl px-4 text-base leading-[160%] text-black/70 sm:text-lg md:text-xl">
            Your learning, projects, and knowledge — together in one secure
            workspace. Sign in to continue.
          </p>

          <Suspense fallback={null}>
            <SessionNotice />
          </Suspense>

          <AnimatePresence initial={false}>
            {!expanded && (
              <motion.div className="relative mt-2 inline-block">
                <motion.div
                  layout
                  layoutId="auth-card"
                  style={{ borderRadius: '100px' }}
                  className="absolute inset-0 transform-gpu bg-[#0b2f86] will-change-transform"
                />
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: 0.2 }}
                  layout={false}
                  onClick={() => setExpanded(true)}
                  className="relative h-15 px-6 py-3 text-lg font-normal tracking-[-0.01em] text-[#E3E3E3] sm:px-8 sm:text-xl"
                >
                  Sign in
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Expanded sign-in panel ─────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div
              layout
              layoutId="auth-card"
              style={{ borderRadius: '24px' }}
              className="relative flex h-full max-h-[760px] w-full max-w-[1000px] overflow-hidden bg-[#0b2f86] transform-gpu will-change-transform"
            >
              {/* MeshGradient fill */}
              <motion.div
                initial={{ opacity: 0, scale: 1.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                layout={false}
                transition={{ duration: 0.2, delay: 0.05 }}
                className="pointer-events-none absolute inset-0 overflow-hidden"
                style={{ borderRadius: '24px' }}
              >
                <MeshGradient
                  speed={prefersReducedMotion ? 0 : 1}
                  colors={['#2452F1', '#022474', '#163DB9', '#0B1D99']}
                  distortion={0.8}
                  swirl={0.1}
                  grainMixer={0}
                  grainOverlay={0}
                  style={{ height: '100%', width: '100%' }}
                />
              </motion.div>

              {/* Content */}
              <div className="relative z-10 flex h-full w-full overflow-y-auto">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="mx-auto flex min-h-full w-full max-w-[1000px] flex-col items-center gap-8 p-6 sm:p-10 lg:flex-row lg:gap-16 lg:p-16"
                >
                  {/* Left: brand / value props */}
                  <div className="flex w-full flex-1 flex-col justify-center space-y-6">
                    <h2 className="text-3xl font-medium leading-none tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
                      Welcome to {BRAND_NAME}
                    </h2>

                    <div className="space-y-5">
                      {[
                        'Access your courses, certifications, and learning progress.',
                        'Track projects, teams, and organization knowledge in one place.',
                        'Ask the AI assistant about anything across the platform.',
                      ].map((line) => (
                        <div key={line} className="flex gap-3 sm:gap-4">
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 sm:h-12 sm:w-12">
                            <svg
                              className="h-5 w-5 text-white sm:h-6 sm:w-6"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                          <p className="text-sm leading-[150%] text-white/90 sm:text-base">
                            {line}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: sign-in form */}
                  <div className="w-full flex-1">
                    <form
                      onSubmit={handleSubmit}
                      className="space-y-4 sm:space-y-5"
                      noValidate
                    >
                      <div>
                        <label
                          htmlFor="username"
                          className="mb-2 block font-mono text-[10px] font-normal uppercase tracking-[0.5px] text-white"
                        >
                          EMAIL OR USERNAME *
                        </label>
                        <input
                          id="username"
                          name="username"
                          type="text"
                          autoComplete="username"
                          autoFocus
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="admin@lms.dev"
                          className="h-11 w-full rounded-lg border-0 bg-[#001F63] px-4 text-sm text-white transition-all placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="password"
                          className="mb-2 block font-mono text-[10px] font-normal uppercase tracking-[0.5px] text-white"
                        >
                          PASSWORD *
                        </label>
                        <input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Admin@1234"
                          className="h-11 w-full rounded-lg border-0 bg-[#001F63] px-4 text-sm text-white transition-all placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                        />
                      </div>

                      {error && (
                        <p
                          role="alert"
                          className="rounded-lg bg-red-500/20 px-4 py-2.5 text-sm text-red-100 ring-1 ring-red-300/40"
                        >
                          {error}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-8 font-medium tracking-[-0.03em] text-[#0041C1] transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {submitting ? (
                          <>
                            <Loader2
                              aria-hidden
                              className="h-5 w-5 animate-spin"
                            />
                            Signing in…
                          </>
                        ) : (
                          'Sign in'
                        )}
                      </button>

                      <p className="text-center font-mono text-[10px] uppercase tracking-[0.5px] text-white/60">
                        Protected by enterprise single sign-on
                      </p>
                    </form>
                  </div>
                </motion.div>
              </div>

              {/* Close */}
              <motion.button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Close"
                className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-white transition-colors hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#e9edf5]">
      <LoginExperience />
    </main>
  );
}

'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Award, BookOpen, LogIn, Sparkles, TrendingUp } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import HeroBackground from '@/components/hero-bg/HeroBackground';
import { BRAND_NAME } from '@/lib/brand';
import { useSearchParams } from 'next/navigation';

function SessionNotice() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  if (reason !== 'session-expired') {
    return null;
  }

  return (
    <div className="mx-auto mb-8 max-w-2xl">
      <Notice variant="warning">
        Your session expired. Sign in again to continue.
      </Notice>
    </div>
  );
}

const HIGHLIGHTS = [
  {
    icon: BookOpen,
    title: 'Guided learning',
    description:
      'Structured courses and modules tailored to every team and role.',
  },
  {
    icon: TrendingUp,
    title: 'Track progress',
    description:
      'Follow completion, activity, and outcomes across your organization.',
  },
  {
    icon: Award,
    title: 'Earn recognition',
    description:
      'Capture achievements and certifications as learners advance.',
  },
] as const;

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden px-6 py-12 md:py-20">
      <HeroBackground />

      <Suspense fallback={null}>
        <SessionNotice />
      </Suspense>

      <div className="mx-auto flex max-w-5xl flex-col items-center gap-12 text-center">
        <section className="flex flex-col items-center gap-7">
          <span className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[color:color-mix(in_oklch,var(--color-primary-soft)_70%,transparent)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            {BRAND_NAME}
          </span>

          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] text-[var(--color-foreground)] md:text-7xl">
            Enterprise learning,{' '}
            <span className="bg-[linear-gradient(120deg,var(--color-primary),color-mix(in_oklch,var(--color-accent)_85%,var(--color-primary)))] bg-clip-text text-transparent">
              made cohesive
            </span>{' '}
            across every team.
          </h1>

          <p className="max-w-2xl text-lg text-[var(--color-muted-foreground)]">
            Reach your courses, track progress, and manage learning across your
            organization — all from one secure, tenant-aware workspace.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/login" className={buttonVariants({ size: 'lg', className: 'px-8' })}>
              <LogIn aria-hidden className="h-5 w-5" />
              Sign in
            </Link>
            <a
              href="#features"
              className={buttonVariants({ variant: 'outline', size: 'lg', className: 'px-8' })}
            >
              Explore the platform
            </a>
          </div>
        </section>

        <section
          id="features"
          className="grid w-full gap-4 text-left sm:grid-cols-3"
        >
          {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="space-y-3 p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[calc(var(--radius)-6px)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Icon aria-hidden className="h-5 w-5" />
              </span>
              <div className="text-sm font-semibold text-[var(--color-foreground)]">
                {title}
              </div>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {description}
              </p>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}

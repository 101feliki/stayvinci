import { useEffect } from 'react';
import { Link } from 'react-router';
import { BadgeCheck, BellOff, EyeOff, MessageSquareQuote, ShieldCheck, Wallet } from 'lucide-react';

const PRINCIPLES = [
  {
    n: 'I',
    icon: BadgeCheck,
    title: 'Every place is verified',
    body: 'Before a store opens, Stayvinci checks the business and the person behind it. Independent professionals are verified one by one.',
  },
  {
    n: 'II',
    icon: MessageSquareQuote,
    title: 'Reviews only from real visits',
    body: 'Only a guest who completed a booking can review it, once. We never write, buy or move reviews.',
  },
  {
    n: 'III',
    icon: Wallet,
    title: 'You pay the place directly',
    body: 'Payments go straight to the business’s own M-Pesa or card account. Stayvinci never holds guest money.',
  },
  {
    n: 'IV',
    icon: BellOff,
    title: 'Neutral notifications',
    body: 'Reminders never name the place or the treatment on your lock screen, unless you choose more detail.',
  },
  {
    n: 'V',
    icon: EyeOff,
    title: 'Your contact stays private',
    body: 'Staff see your name or alias, not your number. Only the owner can see contact details, and only when needed.',
  },
  {
    n: 'VI',
    icon: ShieldCheck,
    title: 'The selection is ours',
    body: 'Places in the season’s selection are chosen by the Stayvinci team. Being listed or featured is never sold.',
  },
];

export function StandardPage() {
  useEffect(() => {
    document.title = 'Our standard · Stayvinci';
    return () => {
      document.title = 'Stayvinci';
    };
  }, []);
  return (
    <main>
      <section className="bg-noir-sheen pt-32 pb-16 text-[#f1ebdf] md:pt-40 md:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="text-[11px] font-medium tracking-[0.26em] text-[#e4cf9f] uppercase">
            The Stayvinci standard
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
            Six promises every place on Stayvinci keeps
          </h1>
          <p className="mt-4 max-w-xl text-[15px] text-[#a59d90]">
            The same rules for a ten-room spa and a single therapist. They are built into the app,
            not left to good intentions.
          </p>
        </div>
      </section>
      <section className="py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-10">
          {PRINCIPLES.map((p) => (
            <div key={p.n} className="rounded-xl border border-line bg-surface p-7 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium tracking-[0.26em] text-gold-600 uppercase dark:text-gold-400">
                  {p.n}
                </span>
                <p.icon className="size-5 text-ink-subtle" />
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">{p.title}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{p.body}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-10">
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-full bg-obsidian-900 px-6 py-3.5 text-sm font-semibold text-white dark:bg-white dark:text-obsidian-900"
          >
            Explore verified places
          </Link>
        </div>
      </section>
    </main>
  );
}

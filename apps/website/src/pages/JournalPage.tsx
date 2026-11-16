import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { media } from '../api';
import { JOURNAL, type Guide } from '../editorial';

const longDate = (d: string) =>
  new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

export function GuideCard({ g }: { g: Guide }) {
  return (
    <Link
      to={`/journal/${g.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-[box-shadow,transform] duration-500 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="aspect-[3/2] overflow-hidden bg-obsidian-900">
        <img
          src={media(g.image) ?? ''}
          alt=""
          loading="lazy"
          className="size-full object-cover brightness-[.88] transition-[transform,filter] duration-[1400ms] group-hover:scale-105 group-hover:brightness-100"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="text-[10px] font-medium tracking-[0.2em] text-ink-subtle uppercase">
          {g.kind} · {longDate(g.date)}
        </div>
        <h3 className="text-lg leading-snug font-semibold tracking-tight">{g.title}</h3>
        <p className="line-clamp-3 text-[13.5px] leading-relaxed text-ink-muted">{g.summary}</p>
        <span className="mt-auto flex items-center gap-2.5 pt-3 text-[10px] font-medium tracking-[0.26em] text-gold-600 uppercase dark:text-gold-400">
          Read
          <span className="h-px w-[18px] bg-current transition-[width] duration-300 group-hover:w-[34px]" />
        </span>
      </div>
    </Link>
  );
}

export function JournalPage() {
  useEffect(() => {
    document.title = 'Journal · Stayvinci';
    return () => {
      document.title = 'Stayvinci';
    };
  }, []);
  return (
    <main>
      <section className="bg-noir-sheen pt-32 pb-14 text-[#f1ebdf] md:pt-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="text-[11px] font-medium tracking-[0.26em] text-[#e4cf9f] uppercase">
            The Journal
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            Guides for slower, better visits
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-[#a59d90]">
            Short, practical reads on treatments, privacy and planning a calm day out.
          </p>
        </div>
      </section>
      <section className="py-14 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-10">
          {JOURNAL.map((g) => (
            <GuideCard key={g.slug} g={g} />
          ))}
        </div>
      </section>
    </main>
  );
}

export function GuidePage() {
  const { slug = '' } = useParams();
  const g = JOURNAL.find((x) => x.slug === slug);
  useEffect(() => {
    document.title = g ? `${g.title} · Stayvinci` : 'Journal · Stayvinci';
    return () => {
      document.title = 'Stayvinci';
    };
  }, [g]);
  if (!g)
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 pt-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">This guide isn’t here</h1>
        <Link
          to="/journal"
          className="mt-6 text-sm font-semibold text-azure-700 dark:text-azure-400"
        >
          Back to the Journal
        </Link>
      </main>
    );
  return (
    <main>
      <section className="relative isolate overflow-hidden bg-noir-950 text-[#f1ebdf]">
        <img
          src={media(g.image) ?? ''}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover opacity-40"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-noir-950 via-noir-950/60 to-noir-950/30" />
        <div className="mx-auto max-w-3xl px-4 pt-32 pb-14 sm:px-6 md:pt-44 md:pb-20">
          <Link
            to="/journal"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="size-4" /> The Journal
          </Link>
          <div className="mt-8 text-[11px] font-medium tracking-[0.24em] text-[#e4cf9f] uppercase">
            {g.kind} · {longDate(g.date)} · {g.minutes} min read
          </div>
          <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
            {g.title}
          </h1>
        </div>
      </section>
      <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 md:py-20">
        <p className="text-lg leading-relaxed text-ink-muted">{g.summary}</p>
        {g.body.map((b, i) => (
          <section key={i} className="mt-8">
            {b.heading ? (
              <h2 className="text-xl font-semibold tracking-tight">{b.heading}</h2>
            ) : null}
            <p className="mt-2 text-[16px] leading-[1.8] text-ink">{b.text}</p>
          </section>
        ))}
        <div className="mt-14 border-t border-line pt-8">
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-full bg-obsidian-900 px-6 py-3.5 text-sm font-semibold text-white dark:bg-white dark:text-obsidian-900"
          >
            Find a place on Stayvinci
          </Link>
        </div>
      </article>
    </main>
  );
}

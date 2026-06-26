type EmptyPageProps = {
  eyebrow?: string;
  title: string;
};

export function EmptyPage({ eyebrow = "Bundesliga App", title }: EmptyPageProps) {
  return (
    <main className="min-w-0 px-7 py-7">
      <section className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-red-500">{eyebrow}</p>
        <h1 className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.01em] text-slate-950">
          {title}
        </h1>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
        <p className="text-sm font-medium text-slate-500">This page is ready. We will build it after Standings.</p>
      </section>
    </main>
  );
}

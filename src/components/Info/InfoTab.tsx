export function InfoTab() {
  return (
    <div className="flex flex-col gap-8 py-4 pb-24 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* HEADER */}
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
          How It Works
        </span>
        <p className="mt-1.5 text-xs font-bold text-[var(--muted)]">
          Status Window turns studying into a progression game.
        </p>
      </div>

      {/* TIMER */}
      <Section title="⏱ Timer" color="sky">
        <Row label="Stopwatch" detail="Runs until you stop it — logs any length." />
        <Row label="Timer" detail="Counts down to a target duration, auto-saves when done." />
        <Row label="Min save" detail="Sessions under 30 s ask before saving to keep history clean." />
      </Section>

      {/* HP */}
      <Section title="❤️ Health (HP)" color="leaf">
        <Row label="+1 HP" detail="Study ≥ 1 hour on a given day." />
        <Row label="−1 HP" detail="Study < 1 hour (or skip) on a given day." />
        <Row label="Goal" detail="Keep positive HP — it tracks your daily consistency from day one." />
        <Row label="Danger zone" detail="HP goes red when negative." />
      </Section>

      {/* LEVEL */}
      <Section title="⬆️ Level" color="sky-dark">
        <Row label="Formula" detail="Total hours ÷ 1 000, rounded. (1 000 h = Level 1)" />
        <Row label="All-time" detail="Level counts every session ever logged — it never resets." />
      </Section>

      {/* STATS TAB */}
      <Section title="📊 Stats" color="muted">
        <Row label="History" detail="Every saved session is listed with subject and duration." />
        <Row label="Radar" detail="Subject breakdown across up to 4 topics." />
        <Row label="Weekly" detail="Bar chart of study hours over the past 7 days." />
      </Section>

      {/* FRIENDS */}
      <Section title="👥 Friends" color="muted">
        <Row label="Add" detail="Copy your User ID and share it; paste a friend's ID to invite." />
        <Row label="Online" detail="Green dot = they have a timer running right now." />
        <Row label="Today" detail="Hours each friend has studied since midnight (UTC)." />
      </Section>

      {/* SUBJECTS */}
      <Section title="📚 Subjects" color="muted">
        <Row label="Custom" detail="Name and colour your own subjects in Settings." />
        <Row label="Archive" detail="Archived subjects are hidden from the timer but kept in stats." />
      </Section>

      <p className="mb-4 text-center text-[9px] font-bold uppercase tracking-widest text-[var(--border)]">
        Status Window — study every day
      </p>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: "sky" | "leaf" | "sky-dark" | "muted";
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className={`text-[10px] font-black uppercase tracking-widest text-[var(--${color})]`}>
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--paper)] px-4 py-3">
        {children}
      </div>
    </section>
  );
}

function Row({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-20 shrink-0 text-[10px] font-black uppercase tracking-wide text-[var(--ink)]">
        {label}
      </span>
      <span className="text-[10px] font-bold leading-4 text-[var(--muted)]">{detail}</span>
    </div>
  );
}

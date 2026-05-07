export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-semibold tracking-normal text-slate-950">{title}</h1>
      {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">{children}</section>;
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "yellow" | "red" | "blue" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    yellow: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-800",
    blue: "bg-sky-100 text-sky-800",
  };
  return <span className={`rounded px-2 py-1 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-[min(92vw,520px)] rounded-md border border-slate-200 bg-white p-4 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded-md border px-2 py-1 text-sm" onClick={onClose}>
            Yopish
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

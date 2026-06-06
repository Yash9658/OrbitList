import { ReactNode } from "react";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";

export const adminInputClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15";

export const adminButtonRowClass = "flex flex-wrap gap-2";
export const adminMetaClass = "flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground";
export const adminNoteClass = "rounded-2xl border border-border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground";
export const adminErrorClass = "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700";

export function AdminPage({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      {children}
    </section>
  );
}

export function AdminDenied({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AdminPage>
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">{title}</h1>
        <p className="mt-3 text-muted-foreground">{children}</p>
      </Card>
    </AdminPage>
  );
}

export function AdminHero({
  eyebrow,
  title,
  children,
  stats
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  stats?: Array<{ label: string; value: number | string }>;
}) {
  return (
    <div className="grid gap-6 rounded-[2rem] border border-border bg-gradient-to-br from-card via-background to-muted/40 p-6 shadow-sm lg:grid-cols-[1fr_auto] lg:p-8">
      <div className="max-w-3xl space-y-4">
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </span>
        <h1 className="text-4xl font-bold leading-[0.98] tracking-[-0.05em] text-foreground md:text-6xl">
          {title}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">{children}</p>
      </div>

      {stats?.length ? (
        <div className="grid min-w-52 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {stats.map((stat) => (
            <div className="rounded-3xl border border-border bg-card p-5" key={stat.label}>
              <strong className="block text-3xl font-bold">{stat.value}</strong>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminPanel({
  eyebrow,
  title,
  description,
  action,
  children
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-6 p-6 md:p-7">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">{title}</h2>
        </div>
        {description ? (
          <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
        {action}
      </div>
      {children}
    </Card>
  );
}

export function AdminEmpty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

export function AdminRow({ children }: { children: ReactNode }) {
  return (
    <article className="grid gap-5 rounded-3xl border border-border bg-card p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_300px]">
      {children}
    </article>
  );
}

export function AdminList({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

export function AdminStatusBadge({ children }: { children: ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>;
}

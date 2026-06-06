import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";

function getErrorMessage(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return error.statusText || "A route error occurred while loading this page.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something unexpected happened while rendering this page.";
}

export function RouteErrorPage() {
  const error = useRouteError();
  const message = getErrorMessage(error);

  return (
    <section className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="max-w-2xl p-8 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          Something went wrong
        </span>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">
          This page hit a runtime issue.
        </h1>
        <p className="mt-3 text-muted-foreground">
          We kept the app alive and captured the error instead of dropping you into the
          default framework crash screen.
        </p>
        <p className="mt-4 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className={cn(buttonVariants())} to="/">
            Go home
          </Link>
          <Link className={cn(buttonVariants({ variant: "outline" }))} to="/marketplace">
            Open marketplace
          </Link>
        </div>
      </Card>
    </section>
  );
}

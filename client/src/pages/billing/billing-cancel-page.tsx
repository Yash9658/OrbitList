import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

export function BillingCancelPage() {
  return (
    <section className="grid min-h-[50vh] place-items-center">
      <Card className="max-w-xl p-8 text-center">
        <Badge variant="secondary" className="uppercase tracking-[0.22em]">Checkout canceled</Badge>
        <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">No changes were made to your plan.</h1>
        <p className="mt-3 text-muted-foreground">You can return to pricing or billing whenever you are ready to continue.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link className={buttonVariants()} to="/pricing">
            Back to pricing
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} to="/billing">
            Open billing
          </Link>
        </div>
      </Card>
    </section>
  );
}

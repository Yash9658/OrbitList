import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

export function TransactionCancelPage() {
  return (
    <section className="grid min-h-[50vh] place-items-center">
      <Card className="max-w-xl p-8 text-center">
        <Badge variant="secondary" className="uppercase tracking-[0.22em]">Checkout cancelled</Badge>
        <h1 className="mt-4 font-serif text-4xl font-black tracking-[-0.06em]">Protected deal checkout was not completed</h1>
        <p className="mt-3 text-muted-foreground">You can return to the listing, ask more questions, or start the protected flow again later.</p>
        <Link className={buttonVariants({ className: "mt-6" })} to="/marketplace">
          Back to marketplace
        </Link>
      </Card>
    </section>
  );
}

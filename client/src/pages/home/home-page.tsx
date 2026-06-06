import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { buttonVariants } from "../../components/ui/button";
import { Card } from "../../components/ui/card";

const featuredListings = [
  {
    title: "Travel media brand with 240k Instagram followers",
    platform: "Instagram",
    niche: "Travel",
    price: "$12,500",
    stats: "5.4% engagement | India + UAE audience"
  },
  {
    title: "Gaming YouTube channel with monetization enabled",
    platform: "YouTube",
    niche: "Gaming",
    price: "$18,000",
    stats: "112k subscribers | 1.1M monthly views"
  },
  {
    title: "Crypto commentary X account with trusted niche reach",
    platform: "X",
    niche: "Crypto",
    price: "$6,400",
    stats: "87k followers | Founder and investor audience"
  },
  {
    title: "Skincare creator page with premium female audience",
    platform: "Instagram",
    niche: "Beauty",
    price: "$9,200",
    stats: "61k followers | 6.9% engagement"
  }
];

const platformSignals = [
  "Instagram theme pages and creator brands",
  "YouTube channels with long-term search value",
  "X profiles for operators, founders, and finance niches",
  "TikTok accounts with repeatable short-form formats",
  "Telegram communities and newsletter-led media assets"
];

const trustSignals = [
  {
    title: "Ownership proof before visibility",
    copy:
      "Sellers prepare screenshots, handle proof, and monetization evidence before a listing becomes believable."
  },
  {
    title: "Metrics that explain quality",
    copy:
      "We surface reach, engagement, audience geography, and monetization context so buyers can judge signal instead of hype."
  },
  {
    title: "Transfer support built into the flow",
    copy:
      "Negotiation, handoff notes, and next-step messaging stay connected to the listing instead of disappearing into scattered DMs."
  }
];

const workflowSteps = [
  {
    label: "01",
    title: "Seller prepares a clean asset story",
    copy:
      "Platform, audience, price, proof, and transfer notes are packaged into one listing that feels ready for review."
  },
  {
    label: "02",
    title: "Buyers compare quality, not just follower count",
    copy:
      "Niche, engagement, audience region, monetization, and verification signals help buyers filter fast."
  },
  {
    label: "03",
    title: "Conversation starts around the exact listing",
    copy:
      "Every message stays attached to the asset so both sides keep context while discussing proofs, price, and transfer."
  }
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
};

export function HomePage() {
  return (
    <div className="flex flex-col gap-12 pb-10">
      <motion.section
        animate="visible"
        className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center"
        initial="hidden"
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        variants={fadeUp}
      >
        <div className="flex max-w-4xl flex-col gap-4">
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.24em]">
            Social asset marketplace
          </Badge>
          <h1 className="max-w-4xl font-serif text-4xl font-black leading-[0.98] tracking-[-0.06em] sm:text-5xl md:text-6xl">
            Buy audience-backed social profiles with clearer trust signals.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
            A marketplace for Instagram pages, YouTube channels, X accounts, TikTok profiles,
            Telegram communities, and other social assets that already have momentum.
          </p>

          <div className="grid gap-3 rounded-3xl border bg-card/60 p-4 sm:grid-cols-3">
            {[
              ["6+", "platform types ready for listing"],
              ["Trust-first", "proof, metrics, and messaging in one flow"],
              ["Built for", "creators, agencies, operators, and buyers"]
            ].map(([value, label]) => (
              <div key={value}>
                <strong className="block text-2xl tracking-[-0.04em]">{value}</strong>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className={buttonVariants({ size: "lg" })} to="/marketplace">
              Explore marketplace
            </Link>
            <Link className={buttonVariants({ variant: "outline", size: "lg" })} to="/dashboard">
              Create a listing
            </Link>
          </div>
        </div>

        <motion.div
          className="rounded-[2rem] border bg-card p-5 shadow-[0_24px_80px_rgba(41,35,25,0.12)]"
          initial={{ opacity: 0, x: 30 }}
          transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true, amount: 0.35 }}
          whileInView={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center justify-between gap-4">
            <Badge variant="secondary">Live market pulse</Badge>
            <span className="text-sm font-semibold text-muted-foreground">Curated inventory</span>
          </div>

          <div className="mt-5">
            <h2 className="font-serif text-2xl font-bold leading-tight tracking-[-0.05em]">
              Premium fashion audience
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Brand-ready engagement with verified marketplace context.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["Followers", "1.02M"],
              ["Engagement", "6.8%"],
              ["Monthly reach", "3.2M"],
              ["Asking price", "$34k"]
            ].map(([label, value]) => (
              <div className="rounded-2xl bg-secondary/60 p-3" key={label}>
                <span className="text-[0.7rem] font-semibold text-muted-foreground">
                  {label}
                </span>
                <strong className="mt-1 block text-xl tracking-[-0.04em]">{value}</strong>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {featuredListings.slice(0, 3).map((listing) => (
              <article
                className="flex items-start justify-between gap-4 rounded-2xl border bg-background/70 p-4"
                key={listing.title}
              >
                <div>
                  <Badge variant="outline">{listing.platform}</Badge>
                  <h3 className="mt-2 font-semibold">{listing.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{listing.stats}</p>
                </div>
                <strong className="whitespace-nowrap">{listing.price}</strong>
              </article>
            ))}
          </div>
        </motion.div>
      </motion.section>

      <motion.section
        className="flex flex-col gap-6"
        initial="hidden"
        transition={{ duration: 0.6 }}
        variants={fadeUp}
        viewport={{ once: true, amount: 0.25 }}
        whileInView="visible"
      >
        <div>
          <Badge variant="outline" className="uppercase tracking-[0.22em]">
            Coverage
          </Badge>
          <h2 className="mt-3 max-w-4xl font-serif text-3xl font-black leading-tight tracking-[-0.05em] md:text-4xl">
            Built around the way social businesses are actually bought.
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-5" aria-label="Supported marketplace categories">
          {platformSignals.map((item) => (
            <Card className="p-4 text-sm font-medium leading-6 text-muted-foreground" key={item}>
              {item}
            </Card>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="flex flex-col gap-6"
        initial="hidden"
        transition={{ duration: 0.6 }}
        variants={fadeUp}
        viewport={{ once: true, amount: 0.25 }}
        whileInView="visible"
      >
        <div>
          <Badge variant="outline" className="uppercase tracking-[0.22em]">
            Why it works
          </Badge>
          <h2 className="mt-3 max-w-3xl font-serif text-3xl font-black leading-tight tracking-[-0.05em] md:text-4xl">
            Trust should be part of the product, not an afterthought.
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {trustSignals.map((signal) => (
            <Card className="p-6" key={signal.title}>
              <h3 className="text-xl font-bold tracking-[-0.04em]">{signal.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{signal.copy}</p>
            </Card>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="flex flex-col gap-6"
        initial="hidden"
        transition={{ duration: 0.6 }}
        variants={fadeUp}
        viewport={{ once: true, amount: 0.25 }}
        whileInView="visible"
      >
        <div>
          <Badge variant="outline" className="uppercase tracking-[0.22em]">
            Marketplace flow
          </Badge>
          <h2 className="mt-3 max-w-3xl font-serif text-3xl font-black leading-tight tracking-[-0.05em] md:text-4xl">
            One structured path from discovery to negotiation.
          </h2>
        </div>

        <div className="grid gap-4">
          {workflowSteps.map((step) => (
            <Card className="grid gap-4 p-6 md:grid-cols-[80px_1fr] md:items-start" key={step.label}>
              <span className="font-serif text-4xl font-black text-primary">{step.label}</span>
              <div>
                <h3 className="text-xl font-bold tracking-[-0.04em]">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.copy}</p>
              </div>
            </Card>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="flex flex-col gap-6"
        initial="hidden"
        transition={{ duration: 0.6 }}
        variants={fadeUp}
        viewport={{ once: true, amount: 0.25 }}
        whileInView="visible"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="outline" className="uppercase tracking-[0.22em]">
              Featured inventory
            </Badge>
            <h2 className="mt-3 max-w-3xl font-serif text-3xl font-black leading-tight tracking-[-0.05em] md:text-4xl">
              Listings should feel specific, comparable, and ready to act on.
            </h2>
          </div>
          <Link className={buttonVariants({ variant: "outline" })} to="/marketplace">
            Browse full marketplace
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featuredListings.map((listing) => (
            <Card className="flex min-h-64 flex-col p-5" key={listing.title}>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{listing.platform}</Badge>
                <Badge variant="secondary">{listing.niche}</Badge>
              </div>
              <h3 className="mt-4 flex-1 text-xl font-bold tracking-[-0.04em]">{listing.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{listing.stats}</p>
              <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
                <strong>{listing.price}</strong>
                <Link className={buttonVariants({ variant: "outline", size: "sm" })} to="/marketplace">
                  View details
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </motion.section>

      <motion.section
        className="grid gap-5 rounded-[2rem] border bg-primary p-6 text-primary-foreground md:grid-cols-[1fr_auto] md:items-center md:p-8"
        initial="hidden"
        transition={{ duration: 0.6 }}
        variants={fadeUp}
        viewport={{ once: true, amount: 0.35 }}
        whileInView="visible"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] opacity-75">Start here</p>
          <h2 className="mt-3 max-w-3xl font-serif text-3xl font-black leading-tight tracking-[-0.05em] md:text-4xl">
            List your asset, or start with the buyers already searching for audience leverage.
          </h2>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link className={buttonVariants({ variant: "outline" })} to="/dashboard">
            Start selling
          </Link>
          <Link className={buttonVariants({ variant: "subtle" })} to="/pricing">
            See seller plans
          </Link>
        </div>
      </motion.section>
    </div>
  );
}

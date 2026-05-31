import Link from "next/link";

import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import { formatMoney, marketingPlans } from "../lib/plans";

export default function PricingPage() {
  return (
    <main className="site-page">
      <div className="site-noise" />
      <SiteHeader />

      <section className="subpage-hero">
        <div className="shell narrow-shell reveal-up">
          <p className="overline">Pricing</p>
          <h1>Pricing is paused while checkout is disabled.</h1>
          <p className="hero-text">
            Free guest output is limited to one watermarked preview. Signed-in
            accounts can currently generate and regenerate without payment.
          </p>
        </div>
      </section>

      <section className="section-block">
        <div className="shell">
          <div className="pricing-grid-marketing">
            {marketingPlans.map((plan, index) => (
              <article
                className={plan.featured ? "price-card price-card-featured reveal-up" : "price-card reveal-up"}
                key={plan.id}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <p className="chip-label">{plan.name}</p>
                <h2>{formatMoney(plan.priceCents)}</h2>
                <div className="price-credits">{plan.credits} credits</div>
                <p>{plan.description}</p>
                <div className="price-meta">
                  <span>{(plan.priceCents / plan.credits).toFixed(0)} cents / credit</span>
                  <span>Planned one-time purchase</span>
                </div>
                <Link className="button button-primary" href="/studio">
                  Open studio
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="shell split-panel">
          <div className="process-panel reveal-up">
            <p className="overline">Included</p>
            <h2>Current access behavior.</h2>
            <div className="bullet-stack">
              <p>HD generation without the guest watermark when signed in.</p>
              <p>Saved before-and-after images on the signed-in account.</p>
              <p>Regeneration from earlier source images.</p>
              <p>Payment gateway integration is temporarily disabled.</p>
            </div>
          </div>

          <div className="quote-panel reveal-up-delayed">
            <p className="overline">Current setup</p>
            <h2>
              Pricing is displayed for planning, while the active experience is in the
              studio workflow.
            </h2>
            <div className="quote-actions">
              <Link className="button button-primary" href="/studio">
                Open studio
              </Link>
              <Link className="button button-muted" href="/how-it-works">
                View workflow
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

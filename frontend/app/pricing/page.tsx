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
          <h1>Credit packs for one-off renders or steady iteration.</h1>
          <p className="hero-text">
            One credit generates one image. Free guest output is limited to one
            watermarked preview, and paid generations unlock saved history and
            regeneration inside the studio.
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
                  <span>One-time purchase</span>
                </div>
                <Link className="button button-primary" href="/studio">
                  Open studio to buy
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
            <h2>What a paid credit actually unlocks.</h2>
            <div className="bullet-stack">
              <p>HD generation without the guest watermark.</p>
              <p>Saved before-and-after images on the signed-in account.</p>
              <p>Regeneration from earlier source images using another credit.</p>
              <p>Payment history visible inside the account dashboard.</p>
            </div>
          </div>

          <div className="quote-panel reveal-up-delayed">
            <p className="overline">Need review pages?</p>
            <h2>
              The site now has separate pricing, workflow, privacy, terms, and refund
              routes for deployment and Paddle review.
            </h2>
            <div className="quote-actions">
              <Link className="button button-primary" href="/terms">
                Terms
              </Link>
              <Link className="button button-muted" href="/refund-policy">
                Refund policy
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

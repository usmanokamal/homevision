import Link from "next/link";

import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import { formatMoney, marketingPlans } from "./lib/plans";

const featureBlocks = [
  {
    title: "One guest preview",
    body: "Visitors can try two low-resolution watermarked previews before they need an account.",
  },
  {
    title: "Signed-in generation",
    body: "Guests get two watermarked previews. Signed-in users can generate and regenerate full previews.",
  },
  {
    title: "Stored history",
    body: "Signed-in users keep before-and-after image history and can revisit earlier generations.",
  },
  {
    title: "Admin visibility",
    body: "Admin users can review users, generation counts, and free-preview usage.",
  },
];

const workflow = [
  "Upload a room photo and choose the surface to edit.",
  "Describe the new material or finish you want applied.",
  "Generate a preview, then save, compare, or regenerate from account history.",
];

export default function HomePage() {
  const featuredPlan = marketingPlans.find((plan) => plan.featured) ?? marketingPlans[0];

  return (
    <main className="site-page">
      <div className="site-noise" />
      <SiteHeader />

      <section className="hero-section">
        <div className="shell hero-grid">
          <div className="hero-copy-block reveal-up">
            <p className="overline">Interior previews, not vague mockups</p>
            <h1>
              Show a new finish on the right surface before anyone buys material.
            </h1>
            <p className="hero-text">
              Room Vision turns a room photo into a controlled material-swap preview.
              The current product supports two free guest previews, signed-in HD generations,
              saved before-and-after history, and regeneration.
            </p>

            <div className="hero-actions">
              <Link className="button button-primary" href="/studio">
                Try the studio
              </Link>
              <Link className="button button-muted" href="/pricing">
                Pricing roadmap
              </Link>
            </div>

            <div className="rule-strip">
              <div className="rule-chip">
                <span className="chip-label">Guest</span>
                <strong>2 free previews</strong>
              </div>
              <div className="rule-chip">
                <span className="chip-label">Signed-in</span>
                <strong>Unlimited generates</strong>
              </div>
              <div className="rule-chip">
                <span className="chip-label">History</span>
                <strong>Before / after saved</strong>
              </div>
            </div>
          </div>

          <div className="hero-visual reveal-up-delayed">
            <div className="hero-frame frame-before">
              <div className="frame-label">Before</div>
              <div className="image-stage image-stage-before">
                <img alt="Original room before redesign" src="/images/room2-before.webp" />
              </div>
            </div>
            <div className="hero-frame frame-after">
              <div className="frame-label">After</div>
              <div className="image-stage image-stage-after">
                <img alt="Room preview after marble floor and grey walls" src="/images/room2-after.jpg" />
              </div>
            </div>
            <div className="hero-floating-card">
              <p className="chip-label">Current best-value pack</p>
              <strong>{featuredPlan.credits} credits</strong>
              <span>{formatMoney(featuredPlan.priceCents)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="marquee-band">
        <div className="marquee-track">
          <span>Accurate product rules</span>
          <span>Black and white interface</span>
          <span>Separate pricing page</span>
          <span>Guest preview paywall</span>
          <span>Stored generation history</span>
          <span>Checkout disabled for now</span>
        </div>
      </section>

      <section className="section-block">
        <div className="shell">
          <div className="section-heading reveal-up">
            <p className="overline">What exists now</p>
            <h2>No invented metrics, no filler copy.</h2>
            <p>
              These are the behaviors currently implemented in the app and backed by
              the FastAPI service.
            </p>
          </div>

          <div className="feature-grid">
            {featureBlocks.map((feature, index) => (
              <article
                className="feature-card reveal-up"
                key={feature.title}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <span className="feature-index">0{index + 1}</span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="shell split-panel">
          <div className="process-panel reveal-up">
            <p className="overline">How it moves</p>
            <h2>Short path from upload to saved design pass.</h2>
            <div className="timeline">
              {workflow.map((item, index) => (
                <div className="timeline-row" key={item}>
                  <span>{index + 1}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="quote-panel reveal-up-delayed">
            <p className="overline">Built for review</p>
            <h2>
              Pricing plans and product behavior can now live on
              separate routes instead of being collapsed into one dashboard.
            </h2>
            <div className="quote-actions">
              <Link className="button button-primary" href="/how-it-works">
                Read the flow
              </Link>
              <Link className="button button-muted" href="/pricing">
                Pricing details
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

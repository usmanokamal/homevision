import Link from "next/link";

import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

const steps = [
  {
    title: "1. Upload a room photo",
    body: "Users upload a JPEG, PNG, or WebP image and choose the surface they want changed, like floor, walls, cabinets, or countertops.",
  },
  {
    title: "2. Describe the new finish",
    body: "The request stays constrained to a single chosen surface, which keeps the prompt grounded instead of rewriting the whole room.",
  },
  {
    title: "3. Generate the preview",
    body: "Guests receive one low-quality watermarked preview. Signed-in users spend one credit for each clean generation.",
  },
  {
    title: "4. Save, compare, regenerate",
    body: "Paid generations are stored with before-and-after image history. Regeneration uses the original source image and spends another credit.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="site-page">
      <div className="site-noise" />
      <SiteHeader />

      <section className="subpage-hero">
        <div className="shell narrow-shell reveal-up">
          <p className="overline">Workflow</p>
          <h1>What the app does, step by step.</h1>
          <p className="hero-text">
            This is the actual behavior currently implemented in Room Vision. It is a
            room-image editing flow with gated guest access, account history, and
            credit-based checkout.
          </p>
        </div>
      </section>

      <section className="section-block">
        <div className="shell timeline-shell">
          {steps.map((step, index) => (
            <article
              className="workflow-card reveal-up"
              key={step.title}
              style={{ animationDelay: `${index * 110}ms` }}
            >
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="shell split-panel">
          <div className="process-panel reveal-up">
            <p className="overline">Operational rules</p>
            <div className="bullet-stack">
              <p>One guest preview per browser session token.</p>
              <p>One paid generation consumes one credit.</p>
              <p>One regeneration also consumes one credit.</p>
              <p>Admin accounts can review user and payment activity.</p>
            </div>
          </div>

          <div className="quote-panel reveal-up-delayed">
            <p className="overline">Next step</p>
            <h2>Use the studio when you want the working app, not the public site.</h2>
            <div className="quote-actions">
              <Link className="button button-primary" href="/studio">
                Open studio
              </Link>
              <Link className="button button-muted" href="/pricing">
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

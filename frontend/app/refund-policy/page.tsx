import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function RefundPolicyPage() {
  return (
    <main className="site-page">
      <div className="site-noise" />
      <SiteHeader />

      <section className="subpage-hero">
        <div className="shell narrow-shell reveal-up">
          <p className="overline">Refunds</p>
          <h1>Refund policy</h1>
          <p className="hero-text">
            This page explains the current refund approach for Home Vision credit
            purchases and billing issues.
          </p>
        </div>
      </section>

      <section className="section-block">
        <div className="shell legal-card reveal-up">
          <h2>Credit purchases</h2>
          <p>
            Credits are sold as one-time packs and are applied to the user account
            after a successful payment event is confirmed.
          </p>

          <h2>Refund requests</h2>
          <p>
            Refund requests may be granted upon review. Home Vision aims to handle
            refund requests fairly, especially in cases involving duplicate
            charges, accidental purchases, billing errors, or unused credits.
          </p>

          <h2>Used and unused credits</h2>
          <p>
            Unused credits are more likely to qualify for a refund. If credits
            have already been substantially used, or if the service has already
            delivered paid outputs connected to that purchase, a full refund may
            be declined or adjusted.
          </p>

          <h2>Request window</h2>
          <p>
            Users should request refunds within 14 days of the payment date by
            emailing{" "}
            <a href="mailto:usmaniskamal@gmail.com">usmaniskamal@gmail.com</a>.
          </p>

          <h2>Payment processing</h2>
          <p>
            Payments are processed through Paddle. Some approved refunds may be
            issued through Paddle as the payment provider and merchant of record.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

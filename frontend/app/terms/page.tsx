import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function TermsPage() {
  return (
    <main className="site-page">
      <div className="site-noise" />
      <SiteHeader />

      <section className="subpage-hero">
        <div className="shell narrow-shell reveal-up">
          <p className="overline">Terms</p>
          <h1>Terms and conditions</h1>
          <p className="hero-text">
            These terms describe the operating rules for Home Vision, including
            accounts, credits, generated previews, and account restrictions.
          </p>
        </div>
      </section>

      <section className="section-block">
        <div className="shell legal-card reveal-up">
          <h2>Operator</h2>
          <p>
            Home Vision is operated independently by Muhammad Usman Kamal in
            Islamabad, Pakistan. Support inquiries can be sent to{" "}
            <a href="mailto:usmaniskamal@gmail.com">usmaniskamal@gmail.com</a>.
          </p>

          <h2>Use of service</h2>
          <p>
            Users may upload room images, generate previews, and consume credits
            based on usage. The service may not be used for fraud, abuse, unlawful
            activity, attempts to interfere with the platform, or any use that
            violates third-party rights.
          </p>

          <h2>Accounts and credits</h2>
          <p>
            Purchased credits are tied to the account that bought them and are used
            when a generation or regeneration is requested. One credit is consumed
            for each paid generation. Credits expire 12 months after the date of
            purchase unless a longer period is required by applicable law.
          </p>

          <h2>Account suspension</h2>
          <p>
            Accounts may be suspended or closed for abuse, fraudulent payment
            activity, chargeback misuse, repeated policy violations, or attempts to
            manipulate the generation system or stored assets.
          </p>

          <h2>Generated output</h2>
          <p>
            Home Vision provides design previews only. Final decisions about
            design, materials, purchases, measurements, installation, and
            suitability remain the user&apos;s responsibility.
          </p>

          <h2>Stored images and inactivity</h2>
          <p>
            Uploaded images and generated outputs may be retained for active paying
            accounts. If an account has no successful payment activity for more than
            60 days, stored images may be removed from the service.
          </p>

          <h2>Governing law</h2>
          <p>
            These terms are governed by the laws of Pakistan, unless otherwise
            required by applicable consumer protection law.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

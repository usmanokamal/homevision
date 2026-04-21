import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function ContactPage() {
  return (
    <main className="site-page">
      <div className="site-noise" />
      <SiteHeader />

      <section className="subpage-hero">
        <div className="shell narrow-shell reveal-up">
          <p className="overline">Contact</p>
          <h1>Contact Home Vision</h1>
          <p className="hero-text">
            Home Vision is currently operated independently by Muhammad Usman Kamal
            from Islamabad, Pakistan.
          </p>
        </div>
      </section>

      <section className="section-block">
        <div className="shell legal-card reveal-up">
          <h2>Operator</h2>
          <p>Muhammad Usman Kamal</p>

          <h2>Brand</h2>
          <p>Home Vision</p>

          <h2>Location</h2>
          <p>Islamabad, Pakistan</p>

          <h2>Support email</h2>
          <p>
            <a href="mailto:usmaniskamal@gmail.com">usmaniskamal@gmail.com</a>
          </p>

          <h2>Product scope</h2>
          <p>
            Home Vision currently offers room-image material preview generation,
            credit-based purchases, account history, and regeneration workflows.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

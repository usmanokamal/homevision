import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";

export default function PrivacyPage() {
  return (
    <main className="site-page">
      <div className="site-noise" />
      <SiteHeader />

      <section className="subpage-hero">
        <div className="shell narrow-shell reveal-up">
          <p className="overline">Privacy</p>
          <h1>Privacy policy</h1>
          <p className="hero-text">
            This page explains what information Home Vision handles in order to
            operate accounts, process payments, and retain generation history.
          </p>
        </div>
      </section>

      <section className="section-block">
        <div className="shell legal-card reveal-up">
          <h2>Who operates the service</h2>
          <p>
            Home Vision is operated by Muhammad Usman Kamal in Islamabad,
            Pakistan. Privacy questions can be sent to{" "}
            <a href="mailto:usmaniskamal@gmail.com">usmaniskamal@gmail.com</a>.
          </p>

          <h2>Data collected</h2>
          <p>
            Home Vision may collect account details such as email address,
            uploaded room images, generated images, credit and payment records,
            guest session identifiers, and basic device or usage information
            needed to protect the service and operate user accounts.
          </p>

          <h2>Uploaded and generated images</h2>
          <p>
            Uploaded room photos and generated outputs may be stored so users can
            revisit their history from the same account. Images are retained for
            active paying accounts. If an account has no successful payment
            activity for more than 60 days, stored uploaded and generated images
            may be deleted.
          </p>

          <h2>Third-party services</h2>
          <p>
            Home Vision uses OpenAI for image-generation functionality and Paddle
            for payment processing. These services may process limited data needed
            to provide their part of the product workflow.
          </p>

          <h2>Payments</h2>
          <p>
            Payments are processed through Paddle. Home Vision stores internal
            purchase records related to credits, payment status, and account
            history, but does not store full payment card information directly.
          </p>

          <h2>Data access, correction, and deletion</h2>
          <p>
            Users may request correction or deletion of account data by contacting{" "}
            <a href="mailto:usmaniskamal@gmail.com">usmaniskamal@gmail.com</a>.
            Some transaction-related information may be retained when required for
            legal, tax, fraud-prevention, or payment recordkeeping purposes.
          </p>

          <h2>Marketing</h2>
          <p>
            Home Vision does not currently describe a separate marketing-email
            program on this site. If that changes, this policy should be updated to
            explain opt-in and opt-out handling.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

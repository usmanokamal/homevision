import Link from "next/link";

export default function CheckoutPage() {
  return (
    <main className="site-page checkout-page">
      <div className="site-noise" />
      <section className="subpage-hero">
        <div className="shell narrow-shell reveal-up">
          <p className="overline">Checkout</p>
          <h1>Checkout is disabled</h1>
          <div className="legal-card">
            <p>
              Payment gateway integration is temporarily removed. Continue using the studio
              without checkout.
            </p>
            <Link className="button button-primary" href="/studio">
              Return to studio
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

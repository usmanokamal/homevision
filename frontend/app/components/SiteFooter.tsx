import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="overline">HomeVision</p>
          <p className="footer-copy">
            Material-swap previews from a single room photo, with accounts,
            credits, saved generations, and review-friendly checkout flow.
          </p>
          <p className="footer-copy">
            Operated by Muhammad Usman Kamal, Islamabad, Pakistan. Support:
            {" "}
            <a href="mailto:usmaniskamal@gmail.com">usmaniskamal@gmail.com</a>
          </p>
        </div>

        <div className="footer-links">
          <Link href="/pricing">Pricing</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund-policy">Refund policy</Link>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p className="overline">Room Vision</p>
          <p className="footer-copy">
            Material-swap previews from a single room photo, with accounts,
            saved generations, and a simple studio workflow.
          </p>
        </div>

        <div className="footer-links">
          <Link href="/pricing">Pricing</Link>
          <Link href="/how-it-works">How it works</Link>
        </div>
      </div>
    </footer>
  );
}

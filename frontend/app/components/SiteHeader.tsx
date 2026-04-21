import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/contact", label: "Contact" },
  { href: "/studio", label: "Studio" },
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell shell-nav">
        <Link className="brand-mark" href="/">
          <span className="brand-dot" />
          <span>Room Vision</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {navItems.map((item) => (
            <Link className="nav-link" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="site-actions">
          <Link className="button button-muted" href="/pricing">
            View pricing
          </Link>
          <Link className="button button-primary" href="/studio">
            Open studio
          </Link>
        </div>
      </div>
    </header>
  );
}

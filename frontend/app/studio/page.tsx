"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type User = {
  id: string;
  email: string;
  is_admin: boolean;
  credit_balance: number;
  created_at: string;
};

type Plan = {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  description: string;
  featured: boolean;
  effective_price_per_credit_cents: number;
};

type Payment = {
  id: string;
  plan_id: string;
  plan_name: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
};

type Generation = {
  id: string;
  target_surface: string;
  requested_change: string;
  final_prompt: string;
  quality_mode: string;
  watermarked: boolean;
  is_free_preview: boolean;
  created_at: string;
  before_image_url: string;
  after_image_url: string;
  source_generation_id?: string | null;
};

type EditResponse = {
  prompt: string;
  is_guest_preview: boolean;
  remaining_credits?: number | null;
  before_image_data_url: string;
  after_image_data_url: string;
  generation?: Generation | null;
};

type AdminUserSummary = {
  id: string;
  email: string;
  is_admin: boolean;
  credit_balance: number;
  created_at: string;
  total_spend_cents: number;
  purchased_credits: number;
  generated_images: number;
};

type AdminOverview = {
  total_users: number;
  total_admins: number;
  total_generations: number;
  total_free_previews: number;
  credits_sold: number;
  credits_consumed: number;
  revenue_cents: number;
  recent_payments: Payment[];
  recent_users: AdminUserSummary[];
};

type AuthResponse = {
  user: User;
};

type Phase = "idle" | "loading" | "done";
type AuthMode = "signup" | "login";

const SURFACE_OPTIONS = [
  "floor",
  "walls",
  "ceiling",
  "cabinets",
  "backsplash",
  "countertops",
  "furniture",
];

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getGuestSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem("homevision_guest_session");
  if (existing) {
    return existing;
  }

  const created = window.crypto.randomUUID();
  window.localStorage.setItem("homevision_guest_session", created);
  return created;
}

async function readErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    detail?: string;
  };
  return payload.detail ?? "Request failed.";
}

export default function StudioPage() {
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);

  const [target, setTarget] = useState("floor");
  const [change, setChange] = useState("matte black tile");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<EditResponse | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [loadingHint, setLoadingHint] = useState(
    "Preparing the source image and prompt."
  );
  const [pageError, setPageError] = useState("");
  const [banner, setBanner] = useState("");
  const [paywallMessage, setPaywallMessage] = useState("");

  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState("");
  const [historyBusyId, setHistoryBusyId] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    if (phase !== "loading") {
      return undefined;
    }

    const messages = [
      "Preparing the source image and prompt.",
      "Constraining the change to the selected surface.",
      "Rendering the preview and updating account history.",
    ];

    let index = 0;
    const interval = window.setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingHint(messages[index]);
    }, 1500);

    return () => {
      window.clearInterval(interval);
    };
  }, [phase]);

  useEffect(() => {
    const checkoutState = new URLSearchParams(window.location.search).get(
      "checkout"
    );
    if (checkoutState === "success") {
      setBanner("Payment completed. Refreshing your account details.");
      window.history.replaceState({}, "", "/studio");
    } else if (checkoutState === "cancelled") {
      setBanner("Checkout was cancelled. No credits were used.");
      window.history.replaceState({}, "", "/studio");
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const plansResponse = await fetch(`${API_BASE_URL}/api/pricing/plans`);
        if (!plansResponse.ok) {
          throw new Error(await readErrorMessage(plansResponse));
        }

        const fetchedPlans = (await plansResponse.json()) as Plan[];
        if (active) {
          setPlans(fetchedPlans);
        }

        const meResponse = await fetch(`${API_BASE_URL}/api/auth/me`, {
          credentials: "include",
        });

        if (meResponse.ok) {
          const payload = (await meResponse.json()) as AuthResponse;
          if (!active) {
            return;
          }
          setUser(payload.user);
          await refreshDashboard(payload.user, active);
        }
      } catch (error) {
        if (!active) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Failed to load the studio.";
        setPageError(message);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function refreshDashboard(nextUser: User | null, isActive = true) {
    if (!nextUser) {
      if (isActive) {
        setGenerations([]);
        setPayments([]);
        setAdminOverview(null);
      }
      return;
    }

    try {
      const requests = [
        fetch(`${API_BASE_URL}/api/generations`, {
          credentials: "include",
        }),
        fetch(`${API_BASE_URL}/api/billing/payments`, {
          credentials: "include",
        }),
      ];

      if (nextUser.is_admin) {
        requests.push(
          fetch(`${API_BASE_URL}/api/admin/overview`, {
            credentials: "include",
          })
        );
      }

      const responses = await Promise.all(requests);
      const [generationsResponse, paymentsResponse, adminResponse] = responses;

      if (!generationsResponse.ok) {
        throw new Error(await readErrorMessage(generationsResponse));
      }
      if (!paymentsResponse.ok) {
        throw new Error(await readErrorMessage(paymentsResponse));
      }

      const nextGenerations = (await generationsResponse.json()) as Generation[];
      const nextPayments = (await paymentsResponse.json()) as Payment[];

      if (!isActive) {
        return;
      }

      setGenerations(nextGenerations);
      setPayments(nextPayments);

      if (nextUser.is_admin && adminResponse) {
        if (!adminResponse.ok) {
          throw new Error(await readErrorMessage(adminResponse));
        }
        setAdminOverview((await adminResponse.json()) as AdminOverview);
      } else {
        setAdminOverview(null);
      }
    } catch (error) {
      if (!isActive) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Failed to refresh account data.";
      setPageError(message);
    }
  }

  function resetComposer() {
    setFile(null);
    setResult(null);
    setPageError("");
    setPhase("idle");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setResult(null);
    setPageError("");
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setPageError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${authMode}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as AuthResponse;
      setUser(payload.user);
      setBanner(
        authMode === "signup"
          ? "Account created. You can now buy credits and save renders."
          : "Signed in."
      );
      setPaywallMessage("");
      await refreshDashboard(payload.user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Authentication failed.";
      setPageError(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    setPageError("");

    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      setGenerations([]);
      setPayments([]);
      setAdminOverview(null);
      setBanner("Signed out.");
    } catch {
      setPageError("Sign out failed.");
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setPageError("Upload a room photo before generating a preview.");
      return;
    }

    if (!change.trim()) {
      setPageError("Describe the finish or material you want.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);
    formData.append("target", target);
    formData.append("change", change.trim());

    setPageError("");
    setPaywallMessage("");
    setPhase("loading");
    setResult(null);

    try {
      const headers = new Headers();
      if (!user) {
        headers.set("X-Guest-Session", getGuestSessionId());
      }

      const response = await fetch(`${API_BASE_URL}/api/edit-image`, {
        method: "POST",
        credentials: "include",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        if (response.status === 402) {
          setPaywallMessage(message);
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as EditResponse;
      setResult(payload);
      setPhase("done");

      if (payload.is_guest_preview) {
        setBanner(
          "Your free preview is low-resolution and watermarked. Create an account to keep generating."
        );
      } else if (user) {
        const refreshedUser: User = {
          ...user,
          credit_balance: payload.remaining_credits ?? user.credit_balance,
        };
        setUser(refreshedUser);
        await refreshDashboard(refreshedUser);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image generation failed.";
      setPageError(message);
      setPhase("idle");
    }
  }

  async function handleCheckout(planId: string) {
    if (!user) {
      setPaywallMessage("Create an account or sign in before buying credits.");
      setAuthMode("signup");
      return;
    }

    setCheckoutPlanId(planId);
    setPageError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/checkout-link`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan_id: planId }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as { checkout_url: string };
      window.location.assign(payload.checkout_url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start checkout.";
      setPageError(message);
    } finally {
      setCheckoutPlanId("");
    }
  }

  async function handleRegenerate(generationId: string) {
    if (!user) {
      setPaywallMessage("Sign in before regenerating a saved design.");
      return;
    }

    setHistoryBusyId(generationId);
    setPhase("loading");
    setPageError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/generations/${generationId}/regenerate`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target,
            change: change.trim(),
          }),
        }
      );

      if (!response.ok) {
        const message = await readErrorMessage(response);
        if (response.status === 402) {
          setPaywallMessage(message);
        }
        throw new Error(message);
      }

      const payload = (await response.json()) as EditResponse;
      setResult(payload);
      setPhase("done");
      const refreshedUser: User = {
        ...user,
        credit_balance: payload.remaining_credits ?? user.credit_balance,
      };
      setUser(refreshedUser);
      await refreshDashboard(refreshedUser);
      setBanner("Regeneration completed and stored in account history.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Regeneration failed.";
      setPageError(message);
      setPhase("idle");
    } finally {
      setHistoryBusyId("");
    }
  }

  const activeBeforeImage = result?.before_image_data_url ?? previewUrl;
  const activeAfterImage = result?.after_image_data_url ?? "";
  const freePreviewUsed = !!result?.is_guest_preview;

  return (
    <main className="studio-page">
      <div className="site-noise" />

      <header className="studio-topbar">
        <div className="shell studio-shell">
          <div>
            <p className="overline">Studio</p>
            <h1>Generate, compare, save, and buy credits.</h1>
            <p className="studio-lead">
              This is the working app. Upload a room photo, change one surface,
              preview the result, and manage paid usage from the same account.
            </p>
          </div>

          <div className="studio-links">
            <Link className="button button-muted" href="/">
              Public site
            </Link>
            <Link className="button button-muted" href="/pricing">
              Pricing
            </Link>
            {user ? (
              <button className="button button-primary" onClick={handleLogout} type="button">
                Log out
              </button>
            ) : (
              <button
                className="button button-primary"
                onClick={() => setAuthMode("signup")}
                type="button"
              >
                Create account
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="shell studio-shell studio-summary-row">
        <article className="studio-summary-card reveal-up">
          <span className="chip-label">Access</span>
          <strong>{user ? "Signed-in account" : "Guest preview mode"}</strong>
          <p>
            {user
              ? `${user.email} with ${user.credit_balance} credits available.`
              : "One free low-resolution watermarked preview is available before signup."}
          </p>
        </article>
        <article className="studio-summary-card reveal-up-delayed">
          <span className="chip-label">Rule</span>
          <strong>1 credit = 1 generation</strong>
          <p>Regeneration also spends another credit from the signed-in account.</p>
        </article>
        <article className="studio-summary-card reveal-up" style={{ animationDelay: "180ms" }}>
          <span className="chip-label">Storage</span>
          <strong>History is persistent</strong>
          <p>Paid users can revisit stored before-and-after image pairs later.</p>
        </article>
      </section>

      {banner ? <p className="studio-banner studio-banner-info shell studio-shell">{banner}</p> : null}
      {pageError ? <p className="studio-banner studio-banner-error shell studio-shell">{pageError}</p> : null}
      {paywallMessage ? (
        <p className="studio-banner studio-banner-warning shell studio-shell">{paywallMessage}</p>
      ) : null}

      <section className="shell studio-shell studio-grid">
        <form className="studio-panel studio-form" onSubmit={handleGenerate}>
          <div className="section-head">
            <div>
              <p className="chip-label">Generator</p>
              <h2>Build a new preview</h2>
            </div>
            <button className="button button-muted" onClick={resetComposer} type="button">
              Reset
            </button>
          </div>

          <label className="input-block">
            <span>Room photo</span>
            <input
              ref={inputRef}
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              type="file"
            />
          </label>

          <label className="input-block">
            <span>Surface to edit</span>
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              {SURFACE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="input-block">
            <span>New material or finish</span>
            <textarea
              maxLength={180}
              onChange={(event) => setChange(event.target.value)}
              placeholder="brushed limestone, dark oak slats, honed marble..."
              rows={4}
              value={change}
            />
          </label>

          <div className="studio-note">
            <p className="chip-label">Prompt rule</p>
            <p>
              The request is applied to the chosen surface only. Guests get one
              watermarked preview; paid generations are clean and saved to history.
            </p>
          </div>

          <button className="button button-primary button-wide" type="submit">
            {user ? "Generate paid preview" : "Generate free preview"}
          </button>
        </form>

        <section className="studio-panel studio-preview">
          <div className="section-head">
            <div>
              <p className="chip-label">Preview</p>
              <h2>Before and after</h2>
            </div>
            <span className="studio-status">
              {phase === "loading"
                ? "Rendering"
                : phase === "done"
                  ? freePreviewUsed
                    ? "Guest preview"
                    : "Saved"
                  : "Waiting"}
            </span>
          </div>

          <div className="studio-preview-grid">
            <article className="preview-card">
              <div className="preview-label">Before</div>
              {activeBeforeImage ? (
                <img alt="Uploaded room" src={activeBeforeImage} />
              ) : (
                <div className="preview-placeholder">
                  <p>Upload a room photo to start the comparison.</p>
                </div>
              )}
            </article>

            <article className="preview-card">
              <div className="preview-label">After</div>
              {activeAfterImage ? (
                <img alt="Generated room preview" src={activeAfterImage} />
              ) : (
                <div className="preview-placeholder preview-placeholder-accent">
                  <p>The generated version will appear here after render.</p>
                </div>
              )}
            </article>
          </div>

          <div className="studio-prompt-box">
            <p className="chip-label">Final prompt</p>
            <p>
              {result?.prompt ??
                `Change only the ${target} to ${change || "your requested finish"}.`}
            </p>
          </div>
        </section>
      </section>

      <section className="shell studio-shell studio-secondary-grid">
        <article className="studio-panel">
          <div className="section-head">
            <div>
              <p className="chip-label">Account</p>
              <h2>{user ? "Session and credits" : "Sign up or sign in"}</h2>
            </div>
          </div>

          {user ? (
            <div className="studio-metric-grid">
              <div className="metric-box">
                <span className="chip-label">Credits</span>
                <strong>{user.credit_balance}</strong>
              </div>
              <div className="metric-box">
                <span className="chip-label">Saved generations</span>
                <strong>{generations.length}</strong>
              </div>
              <div className="metric-box">
                <span className="chip-label">Completed orders</span>
                <strong>
                  {
                    payments.filter((payment) =>
                      ["completed", "paid"].includes(payment.status)
                    ).length
                  }
                </strong>
              </div>
            </div>
          ) : (
            <form className="studio-auth-form" onSubmit={handleAuthSubmit}>
              <div className="segmented-control">
                <button
                  className={authMode === "signup" ? "segment active" : "segment"}
                  onClick={() => setAuthMode("signup")}
                  type="button"
                >
                  Sign up
                </button>
                <button
                  className={authMode === "login" ? "segment active" : "segment"}
                  onClick={() => setAuthMode("login")}
                  type="button"
                >
                  Sign in
                </button>
              </div>

              <label className="input-block">
                <span>Email</span>
                <input
                  onChange={(event) => setAuthEmail(event.target.value)}
                  type="email"
                  value={authEmail}
                />
              </label>

              <label className="input-block">
                <span>Password</span>
                <input
                  minLength={8}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  type="password"
                  value={authPassword}
                />
              </label>

              <button className="button button-primary button-wide" disabled={authBusy} type="submit">
                {authBusy
                  ? "Working..."
                  : authMode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
          )}
        </article>

        <article className="studio-panel">
          <div className="section-head">
            <div>
              <p className="chip-label">Pricing</p>
              <h2>Buy credits</h2>
            </div>
            <Link className="button button-muted" href="/pricing">
              Full pricing page
            </Link>
          </div>

          <div className="studio-plan-grid">
            {plans.map((plan) => (
              <article className={plan.featured ? "studio-plan featured" : "studio-plan"} key={plan.id}>
                <span className="chip-label">{plan.name}</span>
                <h3>{formatMoney(plan.price_cents)}</h3>
                <p className="studio-plan-credits">{plan.credits} credits</p>
                <p>{plan.description}</p>
                <button
                  className="button button-primary button-wide"
                  disabled={checkoutPlanId === plan.id}
                  onClick={() => handleCheckout(plan.id)}
                  type="button"
                >
                  {checkoutPlanId === plan.id ? "Redirecting..." : "Buy credits"}
                </button>
              </article>
            ))}
          </div>
        </article>
      </section>

      {user ? (
        <section className="shell studio-shell studio-history-section">
          <div className="section-head">
            <div>
              <p className="chip-label">History</p>
              <h2>Saved generations</h2>
            </div>
          </div>

          {generations.length === 0 ? (
            <div className="empty-state">
              <p>No saved renders yet. Paid generations will appear here.</p>
            </div>
          ) : (
            <div className="history-grid-v2">
              {generations.map((generation) => (
                <article className="history-card-v2" key={generation.id}>
                  <div className="history-images-v2">
                    <img alt="Saved source room" src={generation.before_image_url} />
                    <img alt="Saved edited room" src={generation.after_image_url} />
                  </div>

                  <div className="history-copy-v2">
                    <div>
                      <p className="chip-label">{formatDate(generation.created_at)}</p>
                      <h3>
                        {generation.target_surface} -&gt; {generation.requested_change}
                      </h3>
                    </div>
                    <p>{generation.final_prompt}</p>
                    <div className="tag-row">
                      <span>{generation.quality_mode}</span>
                      <span>{generation.watermarked ? "watermarked" : "clean export"}</span>
                      {generation.source_generation_id ? <span>regeneration</span> : null}
                    </div>
                    <button
                      className="button button-muted"
                      disabled={historyBusyId === generation.id}
                      onClick={() => handleRegenerate(generation.id)}
                      type="button"
                    >
                      {historyBusyId === generation.id
                        ? "Regenerating..."
                        : "Regenerate with current controls"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {user ? (
        <section className="shell studio-shell studio-history-section">
          <div className="section-head">
            <div>
              <p className="chip-label">Billing</p>
              <h2>Payment log</h2>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="empty-state">
              <p>No payment records yet. Purchases confirmed through Paddle appear here.</p>
            </div>
          ) : (
            <div className="table-v2">
              <div className="table-v2-head">
                <span>Plan</span>
                <span>Credits</span>
                <span>Total</span>
                <span>Status</span>
                <span>Date</span>
              </div>
              {payments.map((payment) => (
                <div className="table-v2-row" key={payment.id}>
                  <span>{payment.plan_name}</span>
                  <span>{payment.credits}</span>
                  <span>{formatMoney(payment.amount_cents, payment.currency.toUpperCase())}</span>
                  <span>{payment.status}</span>
                  <span>{formatDate(payment.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {user?.is_admin && adminOverview ? (
        <section className="shell studio-shell studio-history-section">
          <div className="section-head">
            <div>
              <p className="chip-label">Admin</p>
              <h2>Operational overview</h2>
            </div>
          </div>

          <div className="studio-metric-grid studio-metric-grid-admin">
            <div className="metric-box">
              <span className="chip-label">Revenue</span>
              <strong>{formatMoney(adminOverview.revenue_cents)}</strong>
            </div>
            <div className="metric-box">
              <span className="chip-label">Users</span>
              <strong>{adminOverview.total_users}</strong>
            </div>
            <div className="metric-box">
              <span className="chip-label">Generations</span>
              <strong>{adminOverview.total_generations}</strong>
            </div>
            <div className="metric-box">
              <span className="chip-label">Free previews</span>
              <strong>{adminOverview.total_free_previews}</strong>
            </div>
            <div className="metric-box">
              <span className="chip-label">Credits sold</span>
              <strong>{adminOverview.credits_sold}</strong>
            </div>
            <div className="metric-box">
              <span className="chip-label">Credits consumed</span>
              <strong>{adminOverview.credits_consumed}</strong>
            </div>
          </div>
        </section>
      ) : null}

      {phase === "loading" ? (
        <div className="loading-layer" aria-live="polite">
          <div className="loading-box">
            <p className="overline">Rendering</p>
            <h2>Processing the current design pass</h2>
            <p>{loadingHint}</p>
            <div className="loading-line">
              <div className="loading-line-bar" />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

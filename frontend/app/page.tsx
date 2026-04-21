"use client";

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

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);

  const [target, setTarget] = useState("floor");
  const [change, setChange] = useState("white marble");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<EditResponse | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [loadingHint, setLoadingHint] = useState(
    "Analyzing the room and reserving the edit pipeline."
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
      "Analyzing the room and reserving the edit pipeline.",
      "Preserving geometry while swapping only the chosen material.",
      "Rendering the renovation preview and saving the generation record.",
    ];

    let index = 0;
    const interval = window.setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingHint(messages[index]);
    }, 1600);

    return () => {
      window.clearInterval(interval);
    };
  }, [phase]);

  useEffect(() => {
    const checkoutState = new URLSearchParams(window.location.search).get(
      "checkout"
    );
    if (checkoutState === "success") {
      setBanner("Payment completed. Your credit balance will refresh in a moment.");
      window.history.replaceState({}, "", "/");
    } else if (checkoutState === "cancelled") {
      setBanner("Checkout was cancelled. Your existing credits are unchanged.");
      window.history.replaceState({}, "", "/");
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
          error instanceof Error ? error.message : "Failed to load the app.";
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
        error instanceof Error ? error.message : "Failed to refresh dashboard.";
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
          ? "Account created. Buy credits to export HD renders."
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
      setPageError("Upload a room photo before generating an edit.");
      return;
    }

    if (!change.trim()) {
      setPageError("Enter what you want the selected surface to become.");
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
          "Your one free preview is low-resolution and watermarked. Create an account to buy HD credits."
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
      setBanner("Regeneration completed and saved to account history.");
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
  const promptPreview = `Change only the ${target} to ${change || "..."}.`;
  const freePreviewUsed = !!result?.is_guest_preview;

  return (
    <main className="page-shell">
      <div className="grid-glow grid-glow-left" />
      <div className="grid-glow grid-glow-right" />

      <section className="topbar">
        <div>
          <p className="eyebrow">HomeVision Production Workspace</p>
          <h1>Sell image credits, keep every render, and run the app like a product.</h1>
        </div>

        <div className="account-box">
          {user ? (
            <>
              <div>
                <span className="mini-label">Signed in</span>
                <p>{user.email}</p>
              </div>
              <div>
                <span className="mini-label">Credits</span>
                <p>{user.credit_balance}</p>
              </div>
              <button className="ghost-button" onClick={handleLogout} type="button">
                Log out
              </button>
            </>
          ) : (
            <>
              <div>
                <span className="mini-label">Guest mode</span>
                <p>One free preview with watermark</p>
              </div>
              <button
                className="ghost-button"
                onClick={() => setAuthMode("signup")}
                type="button"
              >
                Create account
              </button>
            </>
          )}
        </div>
      </section>

      <section className="hero-grid">
        <article className="hero-panel">
          <span className="eyebrow">Commerce-ready architecture</span>
          <p className="hero-copy">
            Accounts, Paddle credit packs, render history, regeneration, guest paywall,
            watermarking, storage-backed images, and admin analytics now sit behind the
            same interface.
          </p>
          <div className="metric-row">
            <div className="metric-card">
              <span className="mini-label">Free guest access</span>
              <strong>1 preview</strong>
            </div>
            <div className="metric-card">
              <span className="mini-label">Default price floor</span>
              <strong>$2 per credit</strong>
            </div>
            <div className="metric-card">
              <span className="mini-label">Best pack</span>
              <strong>50 for $75</strong>
            </div>
          </div>
        </article>

        <article className="hero-panel highlight-panel">
          <span className="mini-label">Prompt preview</span>
          <p className="prompt-copy">{promptPreview}</p>
          <p className="support-copy">
            Guest previews are automatically downgraded and watermarked. Signed-in users
            consume one credit per generation or regeneration and can revisit every saved
            before/after pair.
          </p>
        </article>
      </section>

      {banner ? <p className="info-banner">{banner}</p> : null}
      {pageError ? <p className="error-banner">{pageError}</p> : null}
      {paywallMessage ? <p className="warning-banner">{paywallMessage}</p> : null}

      <section className="workspace-grid">
        <form className="control-panel" onSubmit={handleGenerate}>
          <div className="panel-header">
            <div>
              <span className="mini-label">Generator</span>
              <h2>Render a renovation preview</h2>
            </div>
            <button className="ghost-button" onClick={resetComposer} type="button">
              Reset
            </button>
          </div>

          <label className="field">
            <span>Upload room photo</span>
            <input
              ref={inputRef}
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              type="file"
            />
          </label>

          <label className="field">
            <span>Change this surface</span>
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              {SURFACE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>New finish or material</span>
            <textarea
              maxLength={180}
              onChange={(event) => setChange(event.target.value)}
              placeholder="warm walnut slats, limewash plaster, matte charcoal stone..."
              rows={4}
              value={change}
            />
          </label>

          <div className="formula-card">
            <span className="mini-label">Credit rule</span>
            <p>
              {user
                ? `This render will consume 1 credit. Current balance: ${user.credit_balance}.`
                : "Guests get 1 free low-quality preview with watermark, then checkout is required."}
            </p>
          </div>

          <button className="primary-button" type="submit">
            {user ? "Generate HD render" : "Generate free preview"}
          </button>
        </form>

        <section className="preview-panel">
          <div className="panel-header">
            <div>
              <span className="mini-label">Preview</span>
              <h2>Before and after</h2>
            </div>
            <span className="status-pill">
              {phase === "loading"
                ? "Rendering"
                : phase === "done"
                  ? freePreviewUsed
                    ? "Guest preview"
                    : "Saved"
                  : "Waiting"}
            </span>
          </div>

          <div className="preview-grid">
            <article className="image-card">
              <div className="image-label">
                <span>Before</span>
              </div>
              {activeBeforeImage ? (
                <img alt="Uploaded room preview" src={activeBeforeImage} />
              ) : (
                <div className="placeholder">
                  <p>Upload a room photo to create the source image.</p>
                </div>
              )}
            </article>

            <article className="image-card">
              <div className="image-label">
                <span>After</span>
              </div>
              {activeAfterImage ? (
                <img alt="Edited room preview" src={activeAfterImage} />
              ) : (
                <div className="placeholder accent">
                  <p>Your generated preview will appear here.</p>
                </div>
              )}
            </article>
          </div>

          <div className="result-meta">
            <span className="mini-label">Final prompt</span>
            <p>{result?.prompt ?? "The persisted backend prompt will appear after generation."}</p>
          </div>
        </section>
      </section>

      <section className="dashboard-grid">
        <article className="stack-card auth-card">
          <div className="panel-header">
            <div>
              <span className="mini-label">Accounts</span>
              <h2>{user ? "Session active" : "Sign up or sign in"}</h2>
            </div>
          </div>

          {user ? (
            <div className="account-summary">
              <div className="metric-card strong">
                <span className="mini-label">Available credits</span>
                <strong>{user.credit_balance}</strong>
              </div>
              <div className="metric-card">
                <span className="mini-label">Saved generations</span>
                <strong>{generations.length}</strong>
              </div>
              <div className="metric-card">
                <span className="mini-label">Paid orders</span>
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
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <div className="toggle-row">
                <button
                  className={authMode === "signup" ? "toggle active" : "toggle"}
                  onClick={() => setAuthMode("signup")}
                  type="button"
                >
                  Sign up
                </button>
                <button
                  className={authMode === "login" ? "toggle active" : "toggle"}
                  onClick={() => setAuthMode("login")}
                  type="button"
                >
                  Sign in
                </button>
              </div>

              <label className="field">
                <span>Email</span>
                <input
                  onChange={(event) => setAuthEmail(event.target.value)}
                  type="email"
                  value={authEmail}
                />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  minLength={8}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  type="password"
                  value={authPassword}
                />
              </label>

              <button className="primary-button" disabled={authBusy} type="submit">
                {authBusy
                  ? "Working..."
                  : authMode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
          )}
        </article>

        <article className="stack-card">
          <div className="panel-header">
            <div>
              <span className="mini-label">Pricing</span>
              <h2>Credit packs</h2>
            </div>
          </div>

          <div className="pricing-grid">
            {plans.map((plan) => (
              <article
                className={plan.featured ? "plan-card featured" : "plan-card"}
                key={plan.id}
              >
                <span className="mini-label">{plan.name}</span>
                <h3>{formatMoney(plan.price_cents)}</h3>
                <p className="plan-credits">{plan.credits} credits</p>
                <p className="support-copy">{plan.description}</p>
                <p className="rate-copy">
                  {plan.effective_price_per_credit_cents.toFixed(2)} cents per credit
                </p>
                <button
                  className="ghost-button"
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
        <section className="history-section">
          <div className="panel-header">
            <div>
              <span className="mini-label">History</span>
              <h2>Saved generations</h2>
            </div>
          </div>

          {generations.length === 0 ? (
            <div className="empty-card">
              <p>No saved renders yet. Generate your first credited image to populate account history.</p>
            </div>
          ) : (
            <div className="history-grid">
              {generations.map((generation) => (
                <article className="history-card" key={generation.id}>
                  <div className="history-images">
                    <img alt="Saved source room" src={generation.before_image_url} />
                    <img alt="Saved generated room" src={generation.after_image_url} />
                  </div>

                  <div className="history-meta">
                    <div>
                      <span className="mini-label">{formatDate(generation.created_at)}</span>
                      <h3>
                        {generation.target_surface} -&gt; {generation.requested_change}
                      </h3>
                    </div>

                    <p>{generation.final_prompt}</p>
                    <div className="history-tags">
                      <span>{generation.quality_mode}</span>
                      <span>{generation.watermarked ? "watermarked" : "clean export"}</span>
                      {generation.source_generation_id ? <span>regeneration</span> : null}
                    </div>
                    <button
                      className="ghost-button"
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
        <section className="history-section">
          <div className="panel-header">
            <div>
              <span className="mini-label">Billing</span>
              <h2>Payment log</h2>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="empty-card">
              <p>No payments recorded yet. Credit purchases completed through Paddle will appear here.</p>
            </div>
          ) : (
            <div className="table-card">
              <div className="table-head">
                <span>Plan</span>
                <span>Credits</span>
                <span>Total</span>
                <span>Status</span>
                <span>Date</span>
              </div>
              {payments.map((payment) => (
                <div className="table-row" key={payment.id}>
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
        <section className="history-section">
          <div className="panel-header">
            <div>
              <span className="mini-label">Admin</span>
              <h2>Operational overview</h2>
            </div>
          </div>

          <div className="admin-metrics">
            <div className="metric-card strong">
              <span className="mini-label">Revenue</span>
              <strong>{formatMoney(adminOverview.revenue_cents)}</strong>
            </div>
            <div className="metric-card">
              <span className="mini-label">Users</span>
              <strong>{adminOverview.total_users}</strong>
            </div>
            <div className="metric-card">
              <span className="mini-label">Generations</span>
              <strong>{adminOverview.total_generations}</strong>
            </div>
            <div className="metric-card">
              <span className="mini-label">Free previews</span>
              <strong>{adminOverview.total_free_previews}</strong>
            </div>
            <div className="metric-card">
              <span className="mini-label">Credits sold</span>
              <strong>{adminOverview.credits_sold}</strong>
            </div>
            <div className="metric-card">
              <span className="mini-label">Credits consumed</span>
              <strong>{adminOverview.credits_consumed}</strong>
            </div>
          </div>

          <div className="admin-grid">
            <div className="table-card">
              <div className="panel-header tight">
                <div>
                  <span className="mini-label">Recent payments</span>
                  <h3>Paddle transactions applied</h3>
                </div>
              </div>
              <div className="table-head">
                <span>Plan</span>
                <span>User credits</span>
                <span>Total</span>
                <span>Status</span>
                <span>Date</span>
              </div>
              {adminOverview.recent_payments.map((payment) => (
                <div className="table-row" key={payment.id}>
                  <span>{payment.plan_name}</span>
                  <span>{payment.credits}</span>
                  <span>{formatMoney(payment.amount_cents, payment.currency.toUpperCase())}</span>
                  <span>{payment.status}</span>
                  <span>{formatDate(payment.created_at)}</span>
                </div>
              ))}
            </div>

            <div className="table-card">
              <div className="panel-header tight">
                <div>
                  <span className="mini-label">Recent users</span>
                  <h3>Account activity</h3>
                </div>
              </div>
              <div className="table-head">
                <span>Email</span>
                <span>Credits</span>
                <span>Spend</span>
                <span>Images</span>
                <span>Created</span>
              </div>
              {adminOverview.recent_users.map((adminUser) => (
                <div className="table-row" key={adminUser.id}>
                  <span>{adminUser.email}</span>
                  <span>{adminUser.credit_balance}</span>
                  <span>{formatMoney(adminUser.total_spend_cents)}</span>
                  <span>{adminUser.generated_images}</span>
                  <span>{formatDate(adminUser.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {phase === "loading" ? (
        <div className="loading-screen" aria-live="polite">
          <div className="loading-orb loading-orb-a" />
          <div className="loading-orb loading-orb-b" />
          <div className="loading-card">
            <span className="eyebrow">Rendering</span>
            <h2>Saving this design pass</h2>
            <p>{loadingHint}</p>
            <div className="progress-track">
              <div className="progress-bar" />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

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

type AuthResponse = {
  user: User;
};

type Phase = "idle" | "loading" | "done";

const SURFACE_OPTIONS = [
  "floor",
  "walls",
  "ceiling",
  "cabinets",
  "backsplash",
  "countertops",
  "furniture",
];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

  const existing = window.localStorage.getItem("roomvision_guest_session");
  if (existing) {
    return existing;
  }

  const created = window.crypto.randomUUID();
  window.localStorage.setItem("roomvision_guest_session", created);
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
  const [generations, setGenerations] = useState<Generation[]>([]);

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
    let active = true;

    async function bootstrap() {
      try {
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
      }
      return;
    }

    try {
      const generationsResponse = await fetch(`${API_BASE_URL}/api/generations`, {
        credentials: "include",
      });

      if (!generationsResponse.ok) {
        throw new Error(await readErrorMessage(generationsResponse));
      }

      const nextGenerations = (await generationsResponse.json()) as Generation[];

      if (!isActive) {
        return;
      }

      setGenerations(nextGenerations);
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

  async function handleLogout() {
    setPageError("");

    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      setGenerations([]);
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
        await refreshDashboard(user);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image generation failed.";
      setPageError(message);
      setPhase("idle");
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
      await refreshDashboard(user);
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
            <h1>Generate, compare, and save design previews.</h1>
            <p className="studio-lead">
              This is the working app. Upload a room photo, change one surface,
              preview the result, and manage saved outputs from the same account.
            </p>
          </div>

          <div className="studio-links">
            <Link className="button button-muted" href="/">
              Public site
            </Link>
            {user ? (
              <button className="button button-primary" onClick={handleLogout} type="button">
                Log out
              </button>
            ) : null}
          </div>
        </div>
      </header>

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
              watermarked preview; signed-in generations are clean and saved.
            </p>
          </div>

          <button className="button button-primary button-wide" type="submit">
            {user ? "Generate full preview" : "Generate free preview"}
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
              <p>No saved renders yet.</p>
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

"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    Paddle?: {
      Initialized?: boolean;
      Environment: {
        set: (environment: "sandbox" | "production") => void;
      };
      Initialize: (config: {
        token: string;
        pwCustomer?: Record<string, never>;
        checkout?: {
          settings?: {
            displayMode?: "overlay" | "inline";
            locale?: string;
            successUrl?: string;
            theme?: "light" | "dark";
          } | null;
        } | null;
      }) => void;
    };
  }
}

const PADDLE_CLIENT_TOKEN =
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "";
const PADDLE_ENV = process.env.NEXT_PUBLIC_PADDLE_ENV ?? "sandbox";

type CheckoutClientProps = {
  transactionId: string;
};

export default function CheckoutClient({
  transactionId,
}: CheckoutClientProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState("Preparing secure checkout...");

  useEffect(() => {
    if (!scriptReady) {
      return;
    }

    if (!transactionId) {
      setStatus("Missing Paddle transaction id in the checkout URL.");
      return;
    }

    if (!PADDLE_CLIENT_TOKEN) {
      setStatus("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is missing.");
      return;
    }

    const paddle = window.Paddle;
    if (!paddle) {
      setStatus("Paddle.js did not load correctly.");
      return;
    }

    try {
      if (PADDLE_ENV === "sandbox") {
        paddle.Environment.set("sandbox");
      }

      if (!paddle.Initialized) {
        paddle.Initialize({
          token: PADDLE_CLIENT_TOKEN,
          pwCustomer: {},
          checkout: {
            settings: {
              displayMode: "overlay",
              locale: "en",
              successUrl: `${window.location.origin}/studio?checkout=success`,
              theme: "light",
            },
          },
        });
      }

      setStatus(
        "Paddle Checkout should open automatically. Complete payment to return to Room Vision."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to open Paddle Checkout.";
      setStatus(message);
    }
  }, [scriptReady, transactionId]);

  return (
    <>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <main className="site-page checkout-page">
        <div className="site-noise" />
        <section className="subpage-hero">
          <div className="shell narrow-shell reveal-up">
            <p className="overline">Checkout</p>
            <h1>Opening Paddle checkout</h1>
            <div className="legal-card">
              <p>{status}</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

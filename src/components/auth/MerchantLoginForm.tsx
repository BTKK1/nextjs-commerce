"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function MerchantLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  function safeNext() {
    const requested = searchParams.get("next");
    return requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
  }

  async function claimWorkspace() {
    const supabase = createClient();
    const { data, error: claimError } = await supabase.rpc("claim_merchant_memberships_by_email");
    if (claimError) throw claimError;
    const result = Array.isArray(data) ? data[0] as { merchant_count?: number } | undefined : data as { merchant_count?: number } | null;
    if (Number(result?.merchant_count ?? 0) < 1) {
      await supabase.auth.signOut();
      throw new Error("no_workspace");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");
    let safeError = "We couldn't sign you in. Check your email and password, then try again.";
    try {
      const next = safeNext();
      if (email.trim().toLowerCase() === "founder@nbeh.io") {
        const founderResponse = await fetch("/api/auth/founder-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ email, password, next }),
        });
        const founderPayload = await founderResponse.json().catch(() => ({})) as { next?: string; error?: string };
        if (!founderResponse.ok) {
          if (founderResponse.status === 429) safeError = "Too many sign-in attempts. Wait a little, then try again.";
          else if (founderResponse.status === 503) safeError = "Founder sign-in is temporarily unavailable. Try again shortly.";
          throw new Error("Founder sign-in failed");
        }
        router.replace(founderPayload.next || next);
        router.refresh();
        return;
      }
      const supabase = createClient();
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      await claimWorkspace();
      router.replace(next);
      router.refresh();
    } catch (cause) {
      if (cause instanceof Error && cause.message === "Founder sign-in failed") {
        setError(safeError);
        return;
      }
      setError(cause instanceof Error && cause.message === "no_workspace"
        ? "No connected Nbeh store uses this email yet. Use the owner email registered in Salla or Zid."
        : "We couldn’t sign you in. Check your email and password, then try again.");
    } finally {
      setPending(false);
    }
  }

  async function sendMagicLink() {
    const normalizedEmail = email.trim().toLowerCase();
    setError("");
    setNotice("");
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Enter the owner email registered in Salla or Zid first.");
      return;
    }
    if (normalizedEmail === "founder@nbeh.io") {
      setError("Founder access uses the password field above.");
      return;
    }
    setPending(true);
    try {
      const supabase = createClient();
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", safeNext());
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
      });
      if (otpError) throw otpError;
      setNotice("Check your email for a secure Nbeh sign-in link. It expires automatically.");
    } catch {
      setError("We couldn’t send the sign-in link. Wait a moment, then try again.");
    } finally {
      setPending(false);
    }
  }

  const fieldClass = "mt-2 h-13 w-full rounded-[15px] border border-[#DED9E5] bg-[#FBFAFC] px-4 text-[15px] text-[#0B0E12] outline-none transition placeholder:text-[#AAA5B1] hover:border-[#C9C2D4] focus:border-[#5B2EFF] focus:bg-white focus:ring-4 focus:ring-[#5B2EFF]/10 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <form onSubmit={submit} className="mt-8 space-y-5" data-testid="merchant-login-form">
      <label className="block text-sm font-semibold text-[#292530]">
        Work email
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@company.com"
          value={email}
          disabled={pending}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="block text-sm font-semibold text-[#292530]">
        Password
        <span className="relative mt-2 block">
          <input
            required
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            disabled={pending}
            onChange={(event) => setPassword(event.target.value)}
            className={`${fieldClass} mt-0 pr-13`}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute inset-y-0 right-1.5 my-auto flex h-10 w-10 items-center justify-center rounded-xl text-[#807A89] transition hover:bg-[#F0ECFA] hover:text-[#5B2EFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B2EFF]"
          >
            {showPassword ? (
              <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m4 4 16 16M10.6 10.7a2 2 0 0 0 2.7 2.7M9.3 5.3A9.8 9.8 0 0 1 12 5c4.4 0 7.7 3.8 8.7 5.1a3 3 0 0 1 0 3.8 15 15 0 0 1-2.2 2.4M6.3 6.4a15.3 15.3 0 0 0-3 3.7 3 3 0 0 0 0 3.8C4.3 15.2 7.6 19 12 19c1 0 1.9-.2 2.8-.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3.3 10.1C4.3 8.8 7.6 5 12 5s7.7 3.8 8.7 5.1a3 3 0 0 1 0 3.8C19.7 15.2 16.4 19 12 19s-7.7-3.8-8.7-5.1a3 3 0 0 1 0-3.8Z" stroke="currentColor" strokeWidth="1.7" />
                <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            )}
          </button>
        </span>
      </label>

      {error ? (
        <p role="alert" className="flex items-start gap-2.5 rounded-[14px] border border-[#F5C8CE] bg-[#FFF4F5] px-3.5 py-3 text-sm leading-5 text-[#9C2838]">
          <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 6.5v4.2M10 13.7v.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="flex items-start gap-2.5 rounded-[14px] border border-[#C9E8D3] bg-[#F1FBF4] px-3.5 py-3 text-sm leading-5 text-[#176B37]">
          {notice}
        </p>
      ) : null}

      <button
        disabled={pending}
        className="group relative flex h-13 w-full items-center justify-center overflow-hidden rounded-[15px] bg-[#5B2EFF] px-4 font-semibold text-white shadow-[0_14px_30px_-10px_rgba(91,46,255,0.62)] transition hover:-translate-y-0.5 hover:bg-[#4A21D6] hover:shadow-[0_18px_34px_-10px_rgba(91,46,255,0.68)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B2EFF] focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-wait disabled:translate-y-0 disabled:opacity-70"
      >
        <span aria-hidden="true" className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        {pending ? (
          <span className="flex items-center gap-2.5">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Signing in…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Sign in to Nbeh
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 10h12m-4.5-4.5L16 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </button>

      <div className="flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-[#ECEAF0]" /><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9A95A3]">or</span><span className="h-px flex-1 bg-[#ECEAF0]" /></div>

      <button
        type="button"
        disabled={pending}
        onClick={sendMagicLink}
        className="flex h-13 w-full items-center justify-center rounded-[15px] border border-[#DCD5F5] bg-[#F8F6FF] px-4 font-semibold text-[#4A21D6] transition hover:-translate-y-0.5 hover:border-[#BFB1FF] hover:bg-[#F1EDFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B2EFF] focus-visible:ring-offset-2 disabled:cursor-wait disabled:translate-y-0 disabled:opacity-60"
      >
        Email me a secure sign-in link
      </button>
      <p className="-mt-2 text-center text-xs leading-5 text-[#858091]">Use the store-owner email registered in Salla or Zid. No password setup required.</p>
    </form>
  );
}

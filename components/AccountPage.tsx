"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { authClient } from "@/lib/auth-client";

type UserSummary = {
  id: string;
  name: string;
  email: string;
};

export function AccountPage({ callbackUrl, initialUser }: { callbackUrl: string; initialUser: UserSummary | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    const result = mode === "signup"
      ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
      : await authClient.signIn.email({ email: email.trim(), password });
    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "Unable to continue.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <AppShell activePath="/account" title="Account" subtitle="Manage your Merchvision account">
      {() => (
        <div className="account-layout">
          {initialUser ? (
            <section className="account-panel">
              <div>
                <p className="eyebrow">Signed in</p>
                <h2>{initialUser.name}</h2>
                <p className="subtitle">{initialUser.email}</p>
              </div>
              <button className="secondary-btn" onClick={signOut} type="button">
                <LogOut size={16} /> Sign out
              </button>
            </section>
          ) : (
            <section className="account-panel">
              <div className="account-mode-switch" role="tablist" aria-label="Account action">
                <button aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")} role="tab" type="button">
                  Sign in
                </button>
                <button aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} role="tab" type="button">
                  Create account
                </button>
              </div>

              <form className="account-form" onSubmit={submit}>
                {mode === "signup" ? (
                  <div className="field">
                    <label htmlFor="account-name">Name</label>
                    <input autoComplete="name" id="account-name" onChange={(event) => setName(event.target.value)} required value={name} />
                  </div>
                ) : null}
                <div className="field">
                  <label htmlFor="account-email">Email</label>
                  <input autoComplete="email" id="account-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
                </div>
                <div className="field">
                  <label htmlFor="account-password">Password</label>
                  <input autoComplete={mode === "signup" ? "new-password" : "current-password"} id="account-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
                </div>
                {mode === "signup" ? (
                  <div className="field">
                    <label htmlFor="account-confirm-password">Confirm password</label>
                    <input autoComplete="new-password" id="account-confirm-password" minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
                  </div>
                ) : null}
                {error ? <p className="form-error">{error}</p> : null}
                <button className="primary-btn" disabled={pending} type="submit">
                  {pending ? <LoadingSpinner label="Please wait..." size="small" variant="button" /> : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

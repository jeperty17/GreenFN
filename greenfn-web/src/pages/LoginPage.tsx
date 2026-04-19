import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const { user, login, signup } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const redirectTo = useMemo(() => {
    const fromState = location.state as { from?: string } | null;
    return fromState?.from || "/";
  }, [location.state]);

  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      if (mode === "signup") {
        await signup({ name, email, password });
      } else {
        await login({ email, password });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : mode === "signup"
            ? "Unable to sign up"
            : "Unable to login";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-6 py-12">
      <section className="rounded-lg border bg-card p-6 text-card-foreground">
        <h1 className="text-xl font-semibold">GreenFN Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Create your account to start using GreenFN."
            : "Sign in to access the dashboard."}
        </p>

        <div className="mt-4 flex rounded-md border border-input p-1">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setErrorMessage("");
              setName("");
              setEmail("");
              setPassword("");
            }}
            className={[
              "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "signin"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErrorMessage("");
              setName("");
              setEmail("");
              setPassword("");
            }}
            className={[
              "flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "signup"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            Sign up
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <label className="block space-y-1 text-sm">
              <span>Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label className="block space-y-1 text-sm">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              autoComplete="email"
              required
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
          </label>

          {errorMessage ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting
              ? mode === "signup"
                ? "Creating account..."
                : "Signing in..."
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default LoginPage;

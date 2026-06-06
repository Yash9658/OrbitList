import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { UserRole } from "../../types/auth";

const fieldClass = "flex flex-col gap-2";
const labelClass = "text-sm font-semibold text-foreground";
const controlClass =
  "h-11 rounded-xl border bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export function LoginPage() {
  const { login, signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = useMemo(
    () => (location.state as { from?: string } | null)?.from ?? "/dashboard",
    [location.state]
  );
  const searchParams = new URLSearchParams(location.search);
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    username: "",
    country: "",
    role: "BUYER" as UserRole
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login({
          email: form.email,
          password: form.password
        });
      } else {
        await signup({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          username: form.username || undefined,
          country: form.country || undefined,
          role: form.role
        });
      }

      navigate(redirectTo, { replace: true });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Authentication failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid min-h-[calc(100vh-140px)] items-center py-8">
      <div className="grid overflow-hidden rounded-[2rem] border bg-card shadow-[0_28px_90px_rgba(41,35,25,0.12)] lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <div className="p-6 sm:p-10">
          <div>
            <Badge variant="secondary" className="uppercase tracking-[0.22em]">
              {mode === "login" ? "Welcome back" : "New workspace"}
            </Badge>
            <h1 className="mt-5 font-serif text-4xl font-black tracking-[-0.06em]">
              {mode === "login" ? "Log in to orbitlist." : "Create your account."}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {mode === "login" ? "Enter your marketplace credentials." : "Start your buyer or seller workspace."}
            </p>
          </div>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <>
                <label className={fieldClass}>
                  <span className={labelClass}>Full name</span>
                  <input
                    className={controlClass}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, fullName: event.target.value }))
                    }
                    required
                    value={form.fullName}
                  />
                </label>

                <label className={fieldClass}>
                  <span className={labelClass}>Username</span>
                  <input
                    className={controlClass}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, username: event.target.value }))
                    }
                    value={form.username}
                  />
                </label>

                <label className={fieldClass}>
                  <span className={labelClass}>Country</span>
                  <input
                    className={controlClass}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, country: event.target.value }))
                    }
                    value={form.country}
                  />
                </label>

                <label className={fieldClass}>
                  <span className={labelClass}>Role</span>
                  <select
                    className={controlClass}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        role: event.target.value as UserRole
                      }))
                    }
                  >
                    <option value="BUYER">Buyer</option>
                    <option value="SELLER">Seller</option>
                    <option value="BOTH">Buyer and Seller</option>
                  </select>
                </label>
              </>
            ) : null}

            <label className={fieldClass}>
              <span className={labelClass}>Email address</span>
              <input
                className={controlClass}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                required
                type="email"
                value={form.email}
              />
            </label>

            <label className={fieldClass}>
              <span className={labelClass}>Password</span>
              <input
                className={controlClass}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                required
                type="password"
                value={form.password}
              />
            </label>

            {mode === "login" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input className="size-4 accent-primary" type="checkbox" />
                  <span>Remember me</span>
                </label>
                <Link className="font-semibold text-primary" to="/login">
                  Forgot password
                </Link>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-destructive/30 bg-red-50 px-4 py-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}

            <Button disabled={isSubmitting} type="submit">
              {isSubmitting
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Do not have an account?" : "Already have an account?"}{" "}
            <Link className="font-semibold text-primary" to={mode === "login" ? "/login?mode=signup" : "/login"}>
              {mode === "login" ? "Sign up" : "Log in"}
            </Link>
          </p>
        </div>

        <aside
          className="relative hidden overflow-hidden bg-[#edf2ec] p-10 lg:grid lg:place-items-center"
          aria-hidden="true"
        >
          <div className="absolute inset-0">
            <div className="absolute right-10 top-10 size-44 rounded-full bg-primary/10 blur-2xl" />
            <div className="absolute bottom-8 left-8 size-56 rounded-full bg-white/80 blur-2xl" />
            <div className="absolute left-1/2 top-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/10" />
          </div>

          <div className="relative w-full max-w-lg">
            <svg
              className="h-auto w-full drop-shadow-[0_34px_70px_rgba(47,109,104,0.18)]"
              fill="none"
              viewBox="0 0 560 520"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect fill="#fffdf8" height="360" rx="38" width="410" x="75" y="84" />
              <rect height="360" rx="38" stroke="#ded8cc" width="410" x="75" y="84" />
              <rect fill="#2f6d68" height="76" rx="24" width="148" x="206" y="48" />
              <path
                d="M246 85.5 271.5 111 318 65"
                stroke="#fffdf8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="15"
              />

              <rect fill="#f1f6ef" height="64" rx="20" width="286" x="137" y="159" />
              <circle cx="174" cy="191" fill="#2f6d68" r="18" />
              <rect fill="#cfdcd4" height="10" rx="5" width="170" x="207" y="178" />
              <rect fill="#dfe8e2" height="10" rx="5" width="126" x="207" y="197" />

              <rect fill="#fffdf8" height="88" rx="24" stroke="#ded8cc" width="134" x="127" y="255" />
              <path
                d="M165 302c18-28 39-28 58 0"
                stroke="#2f6d68"
                strokeLinecap="round"
                strokeWidth="10"
              />
              <circle cx="194" cy="285" fill="#2f6d68" r="14" />

              <rect fill="#fffdf8" height="88" rx="24" stroke="#ded8cc" width="134" x="298" y="255" />
              <rect fill="#2f6d68" height="14" rx="7" width="70" x="330" y="279" />
              <rect fill="#dfe8e2" height="12" rx="6" width="86" x="322" y="305" />

              <path
                d="M261 299h37"
                stroke="#2f6d68"
                strokeDasharray="8 10"
                strokeLinecap="round"
                strokeWidth="7"
              />
              <path
                d="M280 372c-67 0-124-26-151-65M280 372c67 0 124-26 151-65"
                stroke="#c8d8cf"
                strokeLinecap="round"
                strokeWidth="8"
              />

              <rect fill="#2f6d68" height="52" rx="18" width="196" x="182" y="382" />
              <circle cx="218" cy="408" fill="#fffdf8" r="10" />
              <rect fill="#fffdf8" height="9" rx="4.5" width="104" x="240" y="397" />
              <rect fill="#dce9e3" height="7" rx="3.5" width="76" x="240" y="415" />

              <circle cx="93" cy="139" fill="#fffdf8" r="22" stroke="#ded8cc" />
              <path d="M84 139h18M93 130v18" stroke="#2f6d68" strokeLinecap="round" strokeWidth="5" />
              <circle cx="462" cy="370" fill="#fffdf8" r="24" stroke="#ded8cc" />
              <path
                d="m452 370 8 8 15-18"
                stroke="#2f6d68"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="5"
              />
            </svg>

            <div className="absolute bottom-8 left-1/2 w-[82%] -translate-x-1/2 rounded-3xl border bg-card/90 p-4 shadow-[0_20px_50px_rgba(41,35,25,0.12)] backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <strong className="text-lg tracking-[-0.04em]">Secure profile transfer</strong>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Verified proof, buyer messages, and handoff steps.
                  </span>
                </div>
                <Badge>Ready</Badge>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

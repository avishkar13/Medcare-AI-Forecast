"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { validateLogin, type LoginFieldErrors } from "@/schemas/auth";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Same schema the API validates against, so a malformed email is caught here
    // rather than coming back as a 400 with nothing pointing at the field.
    const parsed = validateLogin({ email, password });
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      return;
    }

    setFieldErrors({});
    setIsPending(true);

    try {
      const result = await authApi.login(parsed.data);
      useAuthStore.getState().login(result.user, result.token);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || "An error occurred during sign in.");
      } else {
        setError("Network error. Please try again later.");
      }
    } finally {
      setIsPending(false);
    }
  };

  /** Clears a field's error as soon as it is edited, rather than on the next submit. */
  const onEmailChange = (value: string) => {
    setEmail(value);
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
  };

  const onPasswordChange = (value: string) => {
    setPassword(value);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
  };

  const isFormValid = email.trim() !== "" && password.trim() !== "";

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-50 selection:bg-primary/10">
      {/* Decorative Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-400/10 blur-[100px]" />
        <div className="absolute -bottom-[25%] -right-[10%] w-[60%] h-[60%] rounded-full bg-teal-400/10 blur-[100px]" />
        
        {/* Very subtle noise texture for premium feel */}
        <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjYiIG51bU9jdGF2ZXM9IjMiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWx0ZXI9InVybCgjYSkiLz48L3N2Zz4=')]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] px-6">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-[1rem] bg-gradient-to-b from-blue-600 to-blue-700 shadow-lg shadow-blue-600/20 ring-1 ring-white/20">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-6 text-[28px] font-semibold tracking-tight text-slate-900">
            MedCare Pharma
          </h1>
          <p className="mt-1.5 text-xs font-semibold text-slate-500 tracking-[0.2em] uppercase">
            Command Center
          </p>
        </div>

        {/* Glassmorphic Login Card */}
        <div className="bg-white/80 backdrop-blur-xl shadow-[0_8px_40px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/5 rounded-2xl overflow-hidden">
          
          <div className="px-8 pt-8 pb-10">
            <div className="mb-8 text-center">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Secure Sign In</h2>
              <p className="text-sm text-slate-500 mt-1">Enter your enterprise credentials</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                {/*
                  Email only. The label used to offer "Employee ID / Email" and the
                  placeholder suggested `ID-8924`, but the API validates this field as
                  an email address, so an employee ID could only ever be rejected.
                */}
                <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder="you@medcare.com"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  disabled={isPending}
                  aria-invalid={fieldErrors.email !== undefined}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  className={`h-11 bg-white shadow-sm focus-visible:ring-1 transition-all text-sm rounded-lg ${
                    fieldErrors.email
                      ? "border-red-300 focus-visible:ring-red-400 focus-visible:border-red-400"
                      : "border-slate-200 focus-visible:ring-primary focus-visible:border-primary"
                  }`}
                  autoComplete="username"
                />
                {fieldErrors.email && (
                  <p id="email-error" className="text-xs font-medium text-red-600">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Password
                  </Label>
                  <button 
                    type="button" 
                    className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                    disabled={isPending}
                  >
                    Recover Access
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    disabled={isPending}
                    aria-invalid={fieldErrors.password !== undefined}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                    className={`h-11 bg-white shadow-sm focus-visible:ring-1 transition-all pr-10 text-sm rounded-lg ${
                      fieldErrors.password
                        ? "border-red-300 focus-visible:ring-red-400 focus-visible:border-red-400"
                        : "border-slate-200 focus-visible:ring-primary focus-visible:border-primary"
                    }`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    disabled={isPending}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {showPassword ? "Hide password" : "Show password"}
                    </span>
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="text-xs font-medium text-red-600">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full h-11 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20 transition-all" 
                  disabled={isPending || !isFormValid}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    "Access System"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Security Footer */}
        <div className="mt-10 flex flex-col items-center">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
            MedCare Internal Network
          </p>
          <p className="text-[11px] text-slate-400 mt-2 max-w-[260px] text-center leading-relaxed">
            Unauthorized access is strictly prohibited and actively monitored.
          </p>
        </div>
      </div>
    </div>
  );
}

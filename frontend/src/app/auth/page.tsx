"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
    <div className="flex min-h-screen w-full bg-background selection:bg-primary/10">
      {/* Left Column - Form */}
      <div className="flex w-full flex-col justify-center px-6 sm:px-12 lg:w-[55%] xl:w-1/2 lg:px-24">
        <div className="mx-auto w-full max-w-[420px]">
          {/* Brand Header */}
          <div className="flex items-center gap-3 mb-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-[0.8rem] bg-gradient-to-b from-primary to-blue-700 shadow-md shadow-primary/20 ring-1 ring-primary/10">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-foreground leading-none">MedCare Pharma</span>
              <span className="text-[10px] font-bold text-muted-foreground tracking-[0.2em] uppercase mt-1.5">Command Center</span>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground mt-2.5">Enter your enterprise credentials to access the AI Engine.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}
            
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
                className={`h-12 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-offset-0 transition-all text-sm rounded-xl ${
                  fieldErrors.email
                    ? "border-red-300 focus-visible:ring-red-400 focus-visible:border-red-400"
                    : "border-border focus-visible:ring-primary/20 focus-visible:border-primary"
                }`}
                autoComplete="username"
              />
              {fieldErrors.email && (
                <p id="email-error" className="text-xs font-medium text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>
            
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
                <span className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-help">
                  Lost access?
                </span>
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
                  className={`h-12 bg-background shadow-sm focus-visible:ring-2 focus-visible:ring-offset-0 transition-all pr-12 text-sm rounded-xl ${
                    fieldErrors.password
                      ? "border-red-300 focus-visible:ring-red-400 focus-visible:border-red-400"
                      : "border-border focus-visible:ring-primary/20 focus-visible:border-primary"
                  }`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
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

            <div className="pt-2">
              <Button 
                type="submit" 
                className="w-full h-12 text-[15px] font-semibold rounded-xl bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 transition-all active:scale-[0.98] cursor-pointer" 
                disabled={isPending || !isFormValid}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Authenticating securely...
                  </>
                ) : (
                  "Access System"
                )}
              </Button>
            </div>
          </form>

          {/* Security Footer */}
          <div className="mt-16 pt-8 border-t border-border">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
              Internal Network Only
            </p>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed font-medium">
              Unauthorized access is strictly prohibited and actively monitored by MedCare InfoSec.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column - Branding/Visual */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative bg-slate-900 items-center justify-center overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950" />
        <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-blue-500/20 blur-[120px] mix-blend-screen" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-teal-400/10 blur-[120px] mix-blend-screen" />
        
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0gNDAgMCBMIDAgMCAwIDQwIiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPgo8L3N2Zz4=')] opacity-30" />

        <div className="relative z-10 w-full max-w-lg p-12 text-white">
           <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold tracking-wide backdrop-blur-md mb-8 shadow-2xl">
             <Sparkles className="mr-2 h-4 w-4 text-blue-300" />
             MedCare AI Forecast Engine v2.0
           </div>
           
           <h2 className="text-[2.75rem] font-extrabold tracking-tight mb-6 leading-[1.1] text-white">
             Intelligent Supply Chain <br/>
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-teal-200">Decision Intelligence</span>
           </h2>
           
           <p className="text-lg text-blue-100/70 leading-relaxed mb-12 font-medium">
             Unify demand forecasting and inventory replenishment using powerful machine learning models to minimize stockouts and reduce expiry risks across your entire distribution network.
           </p>

           <div className="flex items-center gap-5 border-t border-white/10 pt-8">
             <div className="flex -space-x-3">
                <Avatar className="h-11 w-11 border-2 border-slate-900 shadow-sm">
                  <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">AK</AvatarFallback>
                </Avatar>
                <Avatar className="h-11 w-11 border-2 border-slate-900 shadow-sm">
                  <AvatarFallback className="bg-teal-600 text-white text-xs font-bold">JD</AvatarFallback>
                </Avatar>
                <Avatar className="h-11 w-11 border-2 border-slate-900 shadow-sm">
                  <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">MR</AvatarFallback>
                </Avatar>
             </div>
             <p className="text-sm font-semibold text-blue-200/80">
               Trusted by 2,000+ planners globally
             </p>
           </div>
        </div>
      </div>
    </div>
  );
}

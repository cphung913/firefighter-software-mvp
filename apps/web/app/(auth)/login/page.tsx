"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password required"),
});
type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
      callbackUrl,
    });
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }

    // Force a full navigation so middleware sees the fresh session cookie.
    // Use callbackUrl directly — res.url is absolute using NEXTAUTH_URL which may differ from the actual dev port.
    window.location.assign(callbackUrl);
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[#4a4842]">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && (
          <p className="font-body text-[13px] text-[var(--signal)]">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[#4a4842]">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="font-body text-[13px] text-[var(--signal)]">{errors.password.message}</p>
        )}
      </div>
      {error && <p className="font-body text-[13px] text-[var(--signal)]">{error}</p>}
      <Button type="submit" variant="block" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="border border-[#d6cfbf] bg-white p-8">
      <div className="mb-8">
        <h1 className="font-display text-[28px] uppercase tracking-[0.02em] font-medium text-[var(--ink)]">
          Sign In
        </h1>
        <p className="mt-1 font-body text-[15px] text-[var(--ink)]/60">
          Halligan — your department dashboard
        </p>
      </div>
      <Suspense fallback={<div className="h-48 animate-pulse bg-[#e8e2d8]" />}>
        <LoginForm />
      </Suspense>
      <p className="mt-6 font-body text-[14px] text-[var(--ink)]/60 text-center">
        New department?{" "}
        <Link
          href="/signup"
          className="text-[var(--signal)] hover:text-[var(--signal-deep)] transition-colors"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

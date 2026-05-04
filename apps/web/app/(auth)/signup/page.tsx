"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  department_name: z.string().min(2, "Department name required"),
  name: z.string().min(2, "Your name required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(body.detail ?? "Could not create account.");
      return;
    }
    const signInRes = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (signInRes?.error) {
      setError("Account created but sign-in failed. Try the login page.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  });

  return (
    <div className="border border-[#d6cfbf] bg-white p-8">
      <div className="mb-8">
        <h1 className="font-display text-[28px] uppercase tracking-[0.02em] font-medium text-[var(--ink)]">
          Create Your Department
        </h1>
        <p className="mt-1 font-body text-[15px] text-[var(--ink)]/60">
          One account per chief — add personnel after sign in.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="department_name" className="text-[#4a4842]">Department name</Label>
          <Input id="department_name" {...register("department_name")} />
          {errors.department_name && (
            <p className="font-body text-[13px] text-[var(--signal)]">
              {errors.department_name.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-[#4a4842]">Your name</Label>
          <Input id="name" autoComplete="name" {...register("name")} />
          {errors.name && (
            <p className="font-body text-[13px] text-[var(--signal)]">{errors.name.message}</p>
          )}
        </div>
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
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="font-body text-[13px] text-[var(--signal)]">{errors.password.message}</p>
          )}
        </div>
        {error && <p className="font-body text-[13px] text-[var(--signal)]">{error}</p>}
        <Button type="submit" variant="block" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 font-body text-[14px] text-[var(--ink)]/60 text-center">
        Already registered?{" "}
        <Link
          href="/login"
          className="text-[var(--signal)] hover:text-[var(--signal-deep)] transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

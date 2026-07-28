"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Telescope } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [instanceUrl, setInstanceUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceUrl, apiToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Login failed");
        return;
      }
      toast.success("Connected to OpenProject");
      router.push("/dashboard");
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Telescope className="mb-2 size-8" />
          <CardTitle>Connect to OpenProject</CardTitle>
          <CardDescription>Enter your instance URL and API token to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="instanceUrl">Instance URL</Label>
              <Input
                id="instanceUrl"
                placeholder="https://your-domain.openproject.com"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="apiToken">API token</Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="Your OpenProject API token"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? "Connecting…" : "Connect"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")}>
              Continue with dummy data
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

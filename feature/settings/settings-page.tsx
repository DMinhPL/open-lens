"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilters, DEFAULT_PROJECT_KEY } from "@/core/filters-context";
import { useOpSettings } from "@/core/openproject/use-op-settings";
import { useMakeSettings } from "@/core/workflow-instructions/use-make-settings";
import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import { clearUser, fetchCurrentUser } from "@/core/store/userSlice";
import { toast } from "sonner";

export default function SettingsPage() {
  const router = useRouter();
  const { projects, refresh } = useFilters();
  const dispatch = useAppDispatch();
  const { info: currentUser, infoStatus, projects: userProjects, projectsStatus, projectsError } = useAppSelector(
    (state) => state.user,
  );
  const { settings, setSettings, refresh: refreshSettings } = useOpSettings();
  const make = useMakeSettings();
  const [instanceUrl, setInstanceUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [defaultProject, setDefaultProject] = useState("all");
  const [saving, setSaving] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingMakeSettings, setSavingMakeSettings] = useState(false);
  const [webhookCheck, setWebhookCheck] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  useEffect(() => {
    const stored = window.localStorage.getItem(DEFAULT_PROJECT_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only storage post-mount
    if (stored) setDefaultProject(stored);
    // Current user + their projects are already loaded app-wide by <UserBootstrap />
    // in the (app) layout.
  }, []);

  useEffect(() => {
    if (defaultProject === "all" || projects.length === 0) return;
    if (projects.some((projectOption) => String(projectOption.id) === defaultProject)) return;

    const legacyProject = projects.find((projectOption) => projectOption.name === defaultProject);
    const migratedProject = legacyProject ? String(legacyProject.id) : "all";
    window.localStorage.setItem(DEFAULT_PROJECT_KEY, migratedProject);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- migrates legacy name-based project values to IDs
    setDefaultProject(migratedProject);
  }, [defaultProject, projects]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the controlled input once settings arrive
    if (settings) setInstanceUrl(settings.instanceUrl ?? "");
  }, [settings]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the controlled input once the saved webhook URL loads
    setWebhookUrlInput(make.webhookUrl);
  }, [make.webhookUrl]);

  async function handleSaveToken(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!instanceUrl || !apiToken) {
      toast.error("Instance URL and API token are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceUrl, apiToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to save token");
        return;
      }
      toast.success("Token saved. Live OpenProject data is now active.");
      setApiToken("");
      await refreshSettings();
      refresh();
      // Reset first so <UserBootstrap /> (mounted app-wide) sees "idle" and refetches
      // both the user and their project memberships for the newly connected account.
      dispatch(clearUser());
      dispatch(fetchCurrentUser());
    } finally {
      setSaving(false);
    }
  }

  async function handleClearToken() {
    await fetch("/api/login", { method: "DELETE" });
    toast.success("Token cleared. Falling back to dummy data.");
    await refreshSettings();
    refresh();
    dispatch(clearUser());
    dispatch(fetchCurrentUser());
  }

  async function handleSaveMakeSettings(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!webhookUrlInput || !apiKeyInput) {
      toast.error("Webhook URL and API key are required");
      return;
    }
    setSavingMakeSettings(true);
    setWebhookCheck("checking");
    try {

      const res = await fetch("/api/workflow-instructions/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: webhookUrlInput, apiKey: apiKeyInput }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setWebhookCheck("valid");
        make.save(webhookUrlInput, apiKeyInput);
        setApiKeyInput("");
        toast.success("Webhook URL verified. credentials saved");
      } else {
        setWebhookCheck("invalid");
        toast.error("Webhook URL could not be verified — double-check it before generating tasks");
      }
    } finally {
      setSavingMakeSettings(false);
    }
  }

  function handleClearMakeSettings() {
    make.clear();
    setWebhookUrlInput("");
    setApiKeyInput("");
    setWebhookCheck("idle");
    toast.success("Make.com credentials cleared");
  }

  async function handleToggleDummy(useDummyData: boolean) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useDummyData }),
    });
    setSettings((prev) => (prev ? { ...prev, useDummyData } : prev));
    refresh();
    toast.success(useDummyData ? "Using dummy data" : "Using live OpenProject data");
  }

  function handleDefaultProjectChange(value: string) {
    setDefaultProject(value);
    window.localStorage.setItem(DEFAULT_PROJECT_KEY, value);
    toast.success("Default project saved");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Account</CardTitle>
            <CardDescription>Your current OpenProject user and project memberships.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {infoStatus === "loading" && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            )}
            {infoStatus === "failed" && (
              <p className="text-sm text-destructive">Could not load account information.</p>
            )}
            {currentUser && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentUser.email ?? currentUser.login}
                  </p>
                </div>
                {currentUser.admin && <Badge variant="secondary">admin</Badge>}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-sm font-medium">Projects you belong to</p>
              {projectsStatus === "loading" && <Skeleton className="h-4 w-24" />}
              {projectsStatus === "failed" && (
                <p className="text-sm text-destructive">{projectsError ?? "Could not load projects."}</p>
              )}
              {projectsStatus === "succeeded" && userProjects && (
                <>
                  <p className="text-2xl font-bold">{userProjects.length}</p>
                  {userProjects.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {userProjects.map((p) => (
                        <Badge key={p.id} variant="outline">
                          {p.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data source  */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Data source</CardTitle>
            <CardDescription>Toggle between dummy data and your live OpenProject instance.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button
              variant={settings?.useDummyData ? "default" : "outline"}
              onClick={() => handleToggleDummy(true)}
            >
              Dummy data
            </Button>
            <Button
              variant={!settings?.useDummyData ? "default" : "outline"}
              onClick={() => handleToggleDummy(false)}
              disabled={!settings?.hasCredentials}
            >
              Live OpenProject data
            </Button>
          </CardContent>
          {!settings?.hasCredentials && (
            <CardFooter>
              <p className="text-xs text-muted-foreground">Save an API token above to enable live data.</p>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Default project</CardTitle>
            <CardDescription>Pre-select a project when the app loads.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={defaultProject} onValueChange={handleDefaultProjectChange}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((projectOption) => (
                  <SelectItem key={projectOption.id} value={String(projectOption.id)}>
                    {projectOption.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Button variant="ghost" className="w-fit" onClick={() => router.push("/login")}>
          Go to login screen
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        {/* Open Project connection  */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">OpenProject connection</CardTitle>
            <CardDescription>
              {settings?.hasCredentials ? (
                <span className="flex items-center gap-2">
                  Connected to {settings.instanceUrl} <Badge variant="secondary">token saved</Badge>
                </span>
              ) : (
                "No credentials saved — using dummy data."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSaveToken}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="instanceUrl">Instance URL</Label>
                <Input
                  id="instanceUrl"
                  placeholder="https://your-domain.openproject.com"
                  value={instanceUrl}
                  onChange={(e) => setInstanceUrl(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="apiToken">API token</Label>
                <Input
                  id="apiToken"
                  type="password"
                  placeholder="Enter a new token to replace the saved one"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save token"}
                </Button>
                {settings?.hasCredentials && (
                  <Button type="button" variant="outline" onClick={handleClearToken}>
                    Clear token
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Make Connection Settings  */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Make.com connection</CardTitle>
            <CardDescription>
              {make.hasCredentials ? (
                <span className="flex items-center gap-2">
                  Webhook configured <Badge variant="secondary">credentials saved</Badge>
                  {webhookCheck === "checking" && <Badge variant="outline">verifying…</Badge>}
                  {webhookCheck === "valid" && (
                    <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600">
                      webhook verified
                    </Badge>
                  )}
                  {webhookCheck === "invalid" && <Badge variant="destructive">webhook unreachable</Badge>}
                </span>
              ) : (
                "No credentials saved — required to use the Generate tasks from a meeting page."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSaveMakeSettings}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="makeWebhookUrl">Webhook URL</Label>
                <Input
                  id="makeWebhookUrl"
                  placeholder="https://hook.make.com/..."
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="makeApiKey">Make Webhook API key</Label>
                <Input
                  id="makeApiKey"
                  type="password"
                  placeholder="Enter a new key to replace the saved one"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={savingMakeSettings}>
                  {savingMakeSettings ? "Saving & verifying…" : "Save credentials"}
                </Button>
                {make.hasCredentials && (
                  <Button type="button" variant="outline" onClick={handleClearMakeSettings}>
                    Clear credentials
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

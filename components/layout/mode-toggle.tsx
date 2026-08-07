"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMode, type AppMode } from "@/core/mode-context";

const MODE_HOME: Record<AppMode, string> = {
  member: "/dashboard",
  manager: "/pm",
};

/**
 * Switches between the single-user "My work" experience and the "Team" (Project Manager
 * overview) experience, navigating to that mode's home page so the switch takes effect
 * immediately regardless of which page it's toggled from.
 */
export function ModeToggle() {
  const { mode, setMode } = useMode();
  const router = useRouter();

  function handleChange(value: string) {
    const next = value as AppMode;
    if (next === mode) return;
    setMode(next);
    router.push(MODE_HOME[next]);
  }

  return (
    <Tabs value={mode} onValueChange={handleChange}>
      <TabsList>
        <TabsTrigger value="member">My work</TabsTrigger>
        <TabsTrigger value="manager">Team</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

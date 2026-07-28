"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/core/store/hooks";
import { useOpSettings } from "@/core/openproject/use-op-settings";
import { getProjectUrl } from "@/core/openproject/openproject-links";
import { ExternalLink, FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  const { projects, projectsStatus, projectsError } = useAppSelector((state) => state.user);
  const { settings } = useOpSettings();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Your projects</CardTitle>
          <CardDescription>
            Projects you belong to in OpenProject. Click a project to open it on the OpenProject site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectsStatus === "loading" && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {projectsStatus === "failed" && (
            <p className="text-sm text-destructive">{projectsError ?? "Could not load projects."}</p>
          )}

          {projectsStatus === "succeeded" && projects && projects.length === 0 && (
            <p className="text-sm text-muted-foreground">You are not a member of any project yet.</p>
          )}

          {projectsStatus === "succeeded" && projects && projects.length > 0 && (
            <ul className="divide-y">
              {projects.map((project) => (
                <li key={project.id}>
                  <a
                    href={getProjectUrl(settings?.instanceUrl, project.identifier)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-md px-1 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2">
                      <FolderKanban className="size-4 text-muted-foreground" />
                      <span className="font-medium">{project.name}</span>
                      {!project.active && <Badge variant="outline">archived</Badge>}
                    </span>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

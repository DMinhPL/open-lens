"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useFilters } from "@/core/filters-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/core/utils";

interface ProjectOption {
  value: string;
  label: string;
  identifier: string;
}

const ALL_PROJECTS: ProjectOption = { value: "all", label: "All projects", identifier: "" };

/** Lowercases and strips diacritics, so "du an" matches "Dự Án". */
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}

/** Top bar project filter: a searchable combobox, since the project list can be long. */
export function ProjectPicker({ className }: Readonly<{ className?: string }>) {
  const { projects, project, setProject } = useFilters();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const options = useMemo<ProjectOption[]>(
    () => [ALL_PROJECTS, ...projects.map((option) => ({ value: String(option.id), label: option.name, identifier: option.identifier }))],
    [projects],
  );

  const visibleOptions = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.value !== ALL_PROJECTS.value &&
        (normalize(option.label).includes(needle) ||
          normalize(option.identifier).includes(needle)),
    );
  }, [options, query]);

  const selectedLabel = options.find((option) => option.value === project)?.label ?? ALL_PROJECTS.label;
  const activeOption = visibleOptions[activeIndex];

  useEffect(() => {
    if (!open || !activeOption) return;
    listRef.current
      ?.querySelector(`[data-value="${CSS.escape(activeOption.value)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeOption]);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      // Start fresh each time, with the current project highlighted.
      setQuery("");
      setActiveIndex(Math.max(0, options.findIndex((option) => option.value === project)));
    }
    setOpen(nextOpen);
  }

  function select(value: string) {
    setProject(value);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, visibleOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (activeOption) select(activeOption.value);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Project: ${selectedLabel}`}
          className={cn(
            "project-picker__trigger flex h-7 items-center justify-between gap-1.5 rounded-[min(var(--radius-md),10px)] border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="project-picker__content w-(--radix-popover-trigger-width) min-w-64 p-1"
      >
        <div className="project-picker__search flex items-center gap-2 border-b px-2 pb-1">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={activeOption ? `${listId}-${activeOption.value}` : undefined}
            aria-label="Search projects"
            placeholder="Search projects…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="project-picker__input h-8 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Projects"
          className="project-picker__list mt-1 max-h-72 overflow-y-auto"
        >
          {visibleOptions.length === 0 ? (
            <p className="project-picker__empty px-2 py-6 text-center text-sm text-muted-foreground">
              No projects found.
            </p>
          ) : (
            visibleOptions.map((option, index) => {
              const isSelected = option.value === project;
              return (
                <div
                  key={option.value}
                  id={`${listId}-${option.value}`}
                  role="option"
                  aria-selected={isSelected}
                  data-value={option.value}
                  className={cn(
                    "project-picker__option relative flex w-full cursor-default items-center rounded-md py-1 pr-8 pl-1.5 text-sm select-none",
                    index === activeIndex && "bg-accent text-accent-foreground",
                  )}
                  onMouseMove={() => setActiveIndex(index)}
                  // Keep focus in the search input so typing keeps working after hovering.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(option.value)}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? (
                    <CheckIcon className="pointer-events-none absolute right-2 size-4" />
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

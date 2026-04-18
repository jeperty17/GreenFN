/*
 * Overview card for Interaction History: searchable contact selector plus
 * high-level interaction stats for the currently selected contact.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Label } from "../ui/label";
import type { ContactItem } from "./types";

type TimelineStats = {
  total: number;
  calls: number;
  meetings: number;
  chats: number;
  notes: number;
  lastActivity: string | null;
};

interface InteractionOverviewCardProps {
  contacts: ContactItem[];
  selectedContactId: string;
  isLoadingContacts: boolean;
  contactsError: string;
  selectedContact: ContactItem | undefined;
  timelineStats: TimelineStats;
  onSelectContact: (contactId: string) => void;
  formatLastActivity: (dateString: string) => string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function InteractionOverviewCard({
  contacts,
  selectedContactId,
  isLoadingContacts,
  contactsError,
  selectedContact,
  timelineStats,
  onSelectContact,
  formatLastActivity,
}: InteractionOverviewCardProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedName = selectedContact?.fullName || "Select contact";
  const selectedInitials = selectedContact?.fullName
    ? getInitials(selectedContact.fullName)
    : "?";

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      contact.fullName.toLowerCase().includes(query),
    );
  }, [contactSearch, contacts]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!dropdownRef.current) return;
      if (dropdownRef.current.contains(event.target as Node)) return;
      setIsDropdownOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function handleSelect(contactId: string) {
    onSelectContact(contactId);
    setIsDropdownOpen(false);
    setContactSearch("");
  }

  const statTileClasses = {
    total:
      "bg-[oklch(0.97_0.02_145)] text-[oklch(0.33_0.08_145)] border-[oklch(0.9_0.02_145)]",
    calls:
      "bg-[oklch(0.97_0.018_245)] text-[oklch(0.36_0.11_245)] border-[oklch(0.9_0.02_245)]",
    meetings:
      "bg-[oklch(0.97_0.02_80)] text-[oklch(0.42_0.09_80)] border-[oklch(0.9_0.02_80)]",
    chats:
      "bg-[oklch(0.97_0.022_155)] text-[oklch(0.34_0.09_155)] border-[oklch(0.9_0.02_155)]",
    notes:
      "bg-[oklch(0.97_0.008_235)] text-[oklch(0.34_0.04_235)] border-[oklch(0.9_0.01_235)]",
    lastActivity:
      "bg-[oklch(0.97_0.012_165)] text-[oklch(0.31_0.06_165)] border-[oklch(0.9_0.015_165)]",
  };

  return (
    <Card className="border-[oklch(0.89_0.018_145)] bg-[oklch(0.995_0.004_145)]">
      <CardContent className="space-y-6 pt-6">
        <div
          className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3"
          ref={dropdownRef}
        >
          <Label
            htmlFor="contactSelector"
            className="pt-1 text-muted-foreground"
          >
            Viewing
          </Label>

          <div className="relative w-full min-w-0 flex-1 md:min-w-[320px] md:max-w-[640px]">
            <button
              id="contactSelector"
              type="button"
              className="w-full rounded-2xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.994_0.005_145)] px-4 py-3.5 text-left transition-colors duration-200 ease-out hover:bg-[oklch(0.97_0.015_145)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.5_0.14_145)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoadingContacts || contacts.length === 0}
              onClick={() => setIsDropdownOpen((open) => !open)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[oklch(0.86_0.06_145)] text-sm font-semibold text-[oklch(0.28_0.12_145)]">
                    {selectedInitials}
                  </span>
                  <span className="truncate text-base font-semibold text-foreground">
                    {selectedName}
                  </span>
                </span>

                <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
                  {!!selectedContact && (
                    <span className="rounded-full bg-[oklch(0.95_0.02_145)] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[oklch(0.36_0.08_145)]">
                      {timelineStats.total} interactions
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </span>
              </span>
            </button>

            {isDropdownOpen && (
              <div className="absolute z-20 mt-2 w-full rounded-xl border border-[oklch(0.89_0.015_145)] bg-[oklch(0.995_0.004_145)]">
                <div className="border-b border-[oklch(0.9_0.012_145)] p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={contactSearch}
                      onChange={(event) => setContactSearch(event.target.value)}
                      placeholder="Search contacts"
                      className="h-10 w-full rounded-md border border-[oklch(0.89_0.014_145)] bg-[oklch(0.996_0.003_145)] pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(0.5_0.14_145)]/30"
                    />
                  </div>
                </div>

                <ul
                  className="max-h-[360px] overflow-y-auto py-1"
                  role="listbox"
                >
                  {filteredContacts.length === 0 && (
                    <li className="px-4 py-3 text-sm text-muted-foreground">
                      No contacts match your search
                    </li>
                  )}

                  {filteredContacts.map((contact) => {
                    const initials = getInitials(contact.fullName);
                    const isActive = contact.id === selectedContactId;

                    return (
                      <li
                        key={contact.id}
                        role="option"
                        aria-selected={isActive}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelect(contact.id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200 ease-out hover:bg-[oklch(0.975_0.012_145)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.5_0.14_145)] focus-visible:ring-inset"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[oklch(0.91_0.03_145)] text-xs font-semibold text-[oklch(0.34_0.1_145)]">
                              {initials}
                            </span>
                            <span className="truncate text-base font-medium text-foreground">
                              {contact.fullName}
                            </span>
                          </span>

                          <span className="flex shrink-0 items-center gap-2">
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                contact.type === "CLIENT"
                                  ? "bg-[oklch(0.93_0.032_145)] text-[oklch(0.35_0.1_145)]"
                                  : "bg-[oklch(0.94_0.05_80)] text-[oklch(0.44_0.1_80)]",
                              ].join(" ")}
                            >
                              {contact.type === "CLIENT" ? "Client" : "Lead"}
                            </span>
                            {isActive && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        {contactsError && (
          <p className="text-sm text-destructive">Error: {contactsError}</p>
        )}

        {!contactsError && selectedContact && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[oklch(0.9_0.012_145)] bg-[oklch(0.992_0.003_145)] p-2 md:grid-cols-8 md:gap-2.5">
            <div
              className={[
                "rounded-lg border px-4 py-3.5 md:col-span-2",
                statTileClasses.total,
              ].join(" ")}
            >
              <p className="text-[11px] uppercase tracking-wide text-current/75">
                Total
              </p>
              <p className="text-3xl font-semibold leading-none tabular-nums">
                {timelineStats.total}
              </p>
            </div>
            <div
              className={[
                "rounded-lg border px-4 py-3.5 md:col-span-1",
                statTileClasses.calls,
              ].join(" ")}
            >
              <p className="text-[11px] uppercase tracking-wide text-current/75">
                Calls
              </p>
              <p className="text-2xl font-semibold leading-none tabular-nums">
                {timelineStats.calls}
              </p>
            </div>
            <div
              className={[
                "rounded-lg border px-4 py-3.5 md:col-span-1",
                statTileClasses.meetings,
              ].join(" ")}
            >
              <p className="text-[11px] uppercase tracking-wide text-current/75">
                Meetings
              </p>
              <p className="text-2xl font-semibold leading-none tabular-nums">
                {timelineStats.meetings}
              </p>
            </div>
            <div
              className={[
                "rounded-lg border px-4 py-3.5 md:col-span-1",
                statTileClasses.chats,
              ].join(" ")}
            >
              <p className="text-[11px] uppercase tracking-wide text-current/75">
                Chats
              </p>
              <p className="text-2xl font-semibold leading-none tabular-nums">
                {timelineStats.chats}
              </p>
            </div>
            <div
              className={[
                "rounded-lg border px-4 py-3.5 md:col-span-1",
                statTileClasses.notes,
              ].join(" ")}
            >
              <p className="text-[11px] uppercase tracking-wide text-current/75">
                Notes
              </p>
              <p className="text-2xl font-semibold leading-none tabular-nums">
                {timelineStats.notes}
              </p>
            </div>
            <div
              className={[
                "rounded-lg border px-4 py-3.5 md:col-span-2",
                statTileClasses.lastActivity,
              ].join(" ")}
            >
              <p className="text-[11px] uppercase tracking-wide text-current/75">
                Last activity
              </p>
              <p className="text-base font-semibold leading-6 text-foreground">
                {timelineStats.lastActivity
                  ? formatLastActivity(timelineStats.lastActivity)
                  : "—"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InteractionOverviewCard;

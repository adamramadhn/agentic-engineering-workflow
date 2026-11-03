"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button-clean";
import { Sparkles, LogOut } from "@/components/icons";

interface UserProfileMenuProps {
  isCollapsed?: boolean;
  onNavigate?: (route: string) => void;
  onOpenCommand?: () => void;
}

function ProfileAvatar({ name, initials }: { name: string; initials: string }) {
  return (
    <Avatar className="profile-menu-avatar" aria-hidden="true">
      <AvatarImage
        src={`https://api.dicebear.com/7.x/notionists/png?seed=${encodeURIComponent(name)}&size=400&backgroundColor=f5f5f5`}
        alt=""
      />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export function UserProfileMenu({ isCollapsed = false, onOpenCommand }: UserProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data?.user) setAccount({ name: data.user.name, email: data.user.email });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const displayName = account?.name ?? "Onyx";
  const displayEmail = account?.email ?? "hello@onyx.id";
  const initials = displayName.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <style href="profile-menu-clean" precedence="default">{css}</style>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="lg" className="profile-menu-trigger" data-collapsed={isCollapsed || undefined} aria-label={`Open profile menu, ${displayName}, ${displayEmail}`} icon={<ProfileAvatar name={displayName} initials={initials} />} />}
      >
        {!isCollapsed && <span className="profile-menu-details"><bdi>{displayName}</bdi><bdi className="profile-menu-email">{displayEmail}</bdi></span>}
      </DropdownMenuTrigger>

      <DropdownMenuContent side={isCollapsed ? "right" : "top"} align={isCollapsed ? "end" : "start"} sideOffset={4} className="profile-menu-popup" aria-label="Profile">
        <div className="profile-menu-header">
          <ProfileAvatar name={displayName} initials={initials} />
          <div className="profile-menu-details"><bdi>{displayName}</bdi><bdi className="profile-menu-email">{displayEmail}</bdi></div>
        </div>
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={!onOpenCommand} onClick={() => { setOpen(false); onOpenCommand?.(); }}>
            <Sparkles data-icon="inline-start" aria-hidden="true" />
            <span>Open command palette</span>
            <DropdownMenuShortcut aria-hidden="true">⌘/Ctrl K</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={signingOut} onClick={handleSignOut}>
            <LogOut data-icon="inline-start" aria-hidden="true" />
            <span>{signingOut ? "Signing out…" : "Sign out"}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const css = /* css */ `
.profile-menu-trigger.ui-buttonc {
  width: 100%; min-height: 40px; height: auto; padding: 4px 8px; gap: 8px;
  justify-content: flex-start; text-align: start; color: var(--foreground);
}
.profile-menu-trigger.ui-buttonc[data-collapsed] { width: 40px; padding: 6px; margin-inline: auto; }
.profile-menu-trigger .ui-buttonc__label { min-width: 0; white-space: normal; text-align: start; }
.profile-menu-trigger .ui-buttonc__icon { width: 28px; height: 28px; }
.profile-menu-trigger.ui-buttonc:focus-visible { outline: 2px solid var(--foreground); outline-offset: -2px; }
.profile-menu-avatar[data-slot="avatar"] {
  width: 28px; height: 28px; flex: none; border-radius: 6px; background: var(--muted); color: var(--muted-foreground);
}
.profile-menu-avatar [data-slot="avatar-image"] { object-fit: cover; }
.profile-menu-avatar [data-slot="avatar-fallback"] { border-radius: inherit; background: var(--muted); color: var(--muted-foreground); font-size: .75rem; font-weight: 500; }
.profile-menu-details { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; font-size: .8125rem; line-height: 1.5; font-weight: 500; }
.profile-menu-email { font-size: .75rem; line-height: 1.5; font-weight: 400; color: var(--muted-foreground); }
.profile-menu-trigger .profile-menu-email { color: var(--foreground); }
.profile-menu-popup[data-slot="dropdown-menu-content"] {
  width: min(248px, calc(100vw - 32px)); padding: 4px; border: 1px solid var(--border); border-radius: 10px;
  background: var(--popover); color: var(--popover-foreground); box-shadow: none; --tw-ring-shadow: 0 0 #0000;
  font-family: inherit; font-size: .8125rem; line-height: 1.5; overscroll-behavior: contain;
  animation: none; transition: none;
}
.profile-menu-header { display: flex; align-items: center; gap: 8px; padding: 6px 8px 10px; }
.profile-menu-popup [data-slot="dropdown-menu-item"] {
  min-height: 32px; gap: 8px; padding: 6px 8px; font-size: .8125rem; line-height: 1.5;
  white-space: normal; overflow-wrap: anywhere; text-align: start; cursor: pointer;
}
.profile-menu-popup [data-slot="dropdown-menu-item"] > span:not([data-slot="dropdown-menu-shortcut"]) { min-width: 0; }
.profile-menu-popup [data-slot="dropdown-menu-item"]:is(:focus, [data-highlighted]) { background: var(--accent); color: var(--accent-foreground); }
.profile-menu-popup [data-slot="dropdown-menu-item"]:focus-visible { outline: 2px solid var(--popover-foreground); outline-offset: -2px; }
.profile-menu-popup [data-slot="dropdown-menu-shortcut"] { flex: none; margin-inline-start: auto; margin-inline-end: 0; font-family: inherit; font-size: .75rem; letter-spacing: 0; color: inherit; }
.profile-menu-popup [data-slot="dropdown-menu-separator"] { margin: 4px 0; background: var(--border); }
.profile-menu-unavailable { margin-inline-start: auto; font-size: .75rem; }
@media (hover: hover) {
  .profile-menu-popup [data-slot="dropdown-menu-item"]:not([data-disabled]):hover { background: var(--accent); color: var(--accent-foreground); }
}
@media (hover: none) and (pointer: coarse) {
  .profile-menu-trigger.ui-buttonc, .profile-menu-popup [data-slot="dropdown-menu-item"] { min-height: 44px; }
}
`;

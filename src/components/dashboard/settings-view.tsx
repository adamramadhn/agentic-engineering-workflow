"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Trash2,
  Plus,
  Globe,
} from "@/components/icons";
import { toast } from "sonner";

export function SettingsView() {
  const [workspaceName, setWorkspaceName] = useState("Onyx");
  const [workspaceSlug, setWorkspaceSlug] = useState("onyx");
  const [workspaceEmail, setWorkspaceEmail] = useState("hello@onyx.id");
  const [timezone, setTimezone] = useState("UTC (GMT+00:00)");
  const [currency, setCurrency] = useState("USD ($)");

  // Webhook switch states
  const [retryEnabled, setRetryEnabled] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [telemetryShare, setTelemetryShare] = useState(true);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Workspace profile updated", {
      description: "Changes have been saved to your Onyx workspace settings.",
    });
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API key copied to clipboard");
  };

  return (
    <div className="flex flex-col space-y-6 pb-6">
      {/* Header */}
      <div className="border-b border-neutral-100 dark:border-neutral-800 pb-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-neutral-900 dark:text-neutral-100 leading-tight">
          Settings
        </h1>
        <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
          Manage your workspace, team, and integrations.
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-[#f0f0f1] dark:bg-[#18181c] p-0.5 rounded-lg h-9 mb-5">
          <TabsTrigger
            value="general"
            className="text-[12px] font-medium px-3 h-8 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-[#24242a] data-[state=active]:text-neutral-900 dark:data-[state=active]:text-white text-neutral-600 dark:text-neutral-400 data-[state=active]:shadow-2xs cursor-pointer"
          >
            General Profile
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className="text-[12px] font-medium px-3 h-8 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-[#24242a] data-[state=active]:text-neutral-900 dark:data-[state=active]:text-white text-neutral-600 dark:text-neutral-400 data-[state=active]:shadow-2xs cursor-pointer"
          >
            Team Members
          </TabsTrigger>
          <TabsTrigger
            value="apikeys"
            className="text-[12px] font-medium px-3 h-8 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-[#24242a] data-[state=active]:text-neutral-900 dark:data-[state=active]:text-white text-neutral-600 dark:text-neutral-400 data-[state=active]:shadow-2xs cursor-pointer"
          >
            API Keys
          </TabsTrigger>
          <TabsTrigger
            value="webhooks"
            className="text-[12px] font-medium px-3 h-8 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-[#24242a] data-[state=active]:text-neutral-900 dark:data-[state=active]:text-white text-neutral-600 dark:text-neutral-400 data-[state=active]:shadow-2xs cursor-pointer"
          >
            Webhooks & Alerts
          </TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-4">
          <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-[14.5px] font-semibold text-neutral-900 dark:text-neutral-100">
                Workspace Identity
              </CardTitle>
              <CardDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
                This information is displayed across invoices and team invitations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
                <div className="flex items-center gap-3.5 pb-2">
                  <Avatar className="size-14 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700">
                    <AvatarImage
                      src="https://api.dicebear.com/7.x/notionists/png?seed=Fathur&size=400&backgroundColor=f5f5f5"
                      alt="Onyx"
                      className="size-full object-cover scale-[1.25] origin-center"
                    />
                    <AvatarFallback className="text-sm font-semibold">OX</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-[13.5px] font-medium text-neutral-900 dark:text-neutral-100">Workspace Avatar</h4>
                    <p className="text-[11.5px] text-neutral-400 dark:text-neutral-500">
                      Your workspace profile image.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">Workspace Name</label>
                    <Input
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      className="h-8 text-[13px] bg-white dark:bg-[#151519] border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">Workspace Slug</label>
                    <div className="flex items-center">
                      <span className="inline-flex h-8 items-center rounded-l-lg border border-r-0 border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#1a1a20] px-2.5 text-[12px] text-neutral-500 dark:text-neutral-400">
                        onyx.id/
                      </span>
                      <Input
                        value={workspaceSlug}
                        onChange={(e) => setWorkspaceSlug(e.target.value)}
                        className="h-8 rounded-l-none text-[13px] bg-white dark:bg-[#151519] border-neutral-200 dark:border-neutral-800 rounded-r-lg text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">Primary Contact Email</label>
                  <Input
                    value={workspaceEmail}
                    onChange={(e) => setWorkspaceEmail(e.target.value)}
                    className="h-8 text-[13px] bg-white dark:bg-[#151519] border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div className="pt-1">
                  <Button
                    type="submit"
                    className="h-8 px-3.5 text-[12px] bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 text-white rounded-lg cursor-pointer"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Regional Settings */}
          <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-[14.5px] font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Globe className="size-4 text-neutral-500 dark:text-neutral-400" />
                Regional preferences
              </CardTitle>
              <CardDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
                Currency and timezone for reports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-xl">
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">Base Currency</label>
                  <Input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="h-8 text-[13px] bg-white dark:bg-[#151519] border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300">Workspace Timezone</label>
                  <Input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-8 text-[13px] bg-white dark:bg-[#151519] border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEAM TAB */}
        <TabsContent value="team" className="space-y-4">
          <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-[14.5px] font-semibold text-neutral-900 dark:text-neutral-100">
                  Team Members (3)
                </CardTitle>
                <CardDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  Manage roles and permission levels for workspace collaborators
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => toast.info("Invite modal opened")}
                className="h-8 gap-1.5 text-[12px] bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 text-white rounded-lg cursor-pointer"
              >
                <Plus className="size-3.5" />
                Invite Member
              </Button>
            </CardHeader>
            <CardContent className="divide-y divide-neutral-100 dark:divide-neutral-800 p-0">
              {[
                {
                  name: "Onyx Admin",
                  email: "hello@onyx.id",
                  role: "Owner",
                  seed: "Fathur",
                },
                {
                  name: "Sarah Chen",
                  email: "sarah@onyx.id",
                  role: "Billing Manager",
                  seed: "Sarah",
                },
                {
                  name: "Alex Thorne",
                  email: "alex@onyx.id",
                  role: "Developer",
                  seed: "Alex",
                },
              ].map((member) => (
                <div
                  key={member.email}
                  className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50/60 dark:hover:bg-neutral-900/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/notionists/png?seed=${member.seed}&size=400&backgroundColor=f5f5f5`}
                        alt={member.name}
                        className="size-full object-cover scale-[1.25] origin-center"
                      />
                      <AvatarFallback className="text-[10px]">
                        {member.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100 leading-tight">{member.name}</p>
                      <p className="text-[11.5px] text-neutral-400 dark:text-neutral-500 leading-tight mt-0.5">{member.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700">
                    {member.role}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API KEYS TAB */}
        <TabsContent value="apikeys" className="space-y-4">
          <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-[14.5px] font-semibold text-neutral-900 dark:text-neutral-100">
                  Secret API Keys
                </CardTitle>
                <CardDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  Use these keys to authenticate server-to-server sync operations
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => toast.success("New API key generated: onx_live_•••8812")}
                className="h-8 gap-1.5 text-[12px] bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 text-white rounded-lg cursor-pointer"
              >
                <Plus className="size-3.5" />
                Create New Key
              </Button>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[
                { name: "Production Ingest Key", prefix: "onx_live_9a7d••••••••••••••4821", created: "Jun 12, 2026" },
                { name: "Staging Pipeline Key", prefix: "onx_test_4b1c••••••••••••••9923", created: "Jul 01, 2026" },
              ].map((key) => (
                <div
                  key={key.name}
                  className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40"
                >
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">{key.name}</p>
                    <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">{key.prefix}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyKey(key.prefix)}
                      className="h-7 gap-1.5 text-[11px] border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 cursor-pointer"
                    >
                      <Copy className="size-3 text-neutral-500" />
                      <span>Copy</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toast.error("Key revocation requested")}
                      className="h-7 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WEBHOOKS TAB */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-[14.5px] font-semibold text-neutral-900 dark:text-neutral-100">
                Automated Sync & Webhooks
              </CardTitle>
              <CardDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
                Configure fault-tolerant event notifications and retry policies
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-neutral-100 dark:divide-neutral-800 p-0">
              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="space-y-0.5">
                  <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                    Automatic Exponential Webhook Retries
                  </p>
                  <p className="text-[11.5px] text-neutral-400 dark:text-neutral-500">
                    Retry failed outbound event posts with exponential backoff up to 72 hours
                  </p>
                </div>
                <Switch
                  checked={retryEnabled}
                  onCheckedChange={(val) => {
                    setRetryEnabled(val);
                    toast.info(`Webhook retries ${val ? "enabled" : "disabled"}`);
                  }}
                />
              </div>

              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="space-y-0.5">
                  <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                    Slack Incident Notifications
                  </p>
                  <p className="text-[11.5px] text-neutral-400 dark:text-neutral-500">
                    Post critical connector interruptions directly to #onyx-alerts channel
                  </p>
                </div>
                <Switch
                  checked={slackAlerts}
                  onCheckedChange={(val) => {
                    setSlackAlerts(val);
                    toast.info(`Slack alerts ${val ? "enabled" : "disabled"}`);
                  }}
                />
              </div>

              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="space-y-0.5">
                  <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                    Weekly Telemetry Digest
                  </p>
                  <p className="text-[11.5px] text-neutral-400 dark:text-neutral-500">
                    Send executive summary of all 1,204 transactions to hello@onyx.id
                  </p>
                </div>
                <Switch
                  checked={emailDigest}
                  onCheckedChange={(val) => {
                    setEmailDigest(val);
                    toast.info(`Email digest ${val ? "enabled" : "disabled"}`);
                  }}
                />
              </div>

              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="space-y-0.5">
                  <p className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
                    Anonymous Telemetry Sharing
                  </p>
                  <p className="text-[11.5px] text-neutral-400 dark:text-neutral-500">
                    Help improve connector reliability by sharing anonymous error metrics
                  </p>
                </div>
                <Switch
                  checked={telemetryShare}
                  onCheckedChange={(val) => {
                    setTelemetryShare(val);
                    toast.info(`Telemetry sharing ${val ? "enabled" : "disabled"}`);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

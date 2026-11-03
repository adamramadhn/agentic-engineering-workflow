export { ConnectIcon, HomeIcon, MetricsIcon, ReportsIcon, AlertsIcon, SettingsIcon, CustomersIcon, ComponentsIcon } from "@/components/icons";

export function BrightdeskMark({ className = "size-[20px]" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-[5px] bg-[#1a1a1a] text-white shadow-2xs ${className}`}
    >
      <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
        <path d="M8 1.8a.9.9 0 0 1 .9.9v2.25l1.95-1.12a.9.9 0 0 1 .9 1.56l-1.95 1.12 1.95 1.13a.9.9 0 0 1-.9 1.56L8.9 7.2v2.25a.9.9 0 0 1-1.8 0V7.2l-1.95 1.13a.9.9 0 0 1-.9-1.56l1.95-1.13-1.95-1.12a.9.9 0 0 1 .9-1.56L7.1 4.95V2.7a.9.9 0 0 1 .9-.9z" />
      </svg>
    </div>
  );
}

export function StripeMark() {
  return (
    <div className="flex size-[34px] shrink-0 items-center justify-center rounded-lg border border-[#e5e5e7] bg-white shadow-2xs">
      <svg viewBox="0 0 12 10" className="h-3 w-3.5">
        <polygon points="0,2.6 12,0 12,7.4 0,10" fill="#635BFF" />
      </svg>
    </div>
  );
}

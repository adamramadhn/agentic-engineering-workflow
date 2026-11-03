import Image from "next/image";
import { WATCHED_COMPANIES } from "@/components/dashboard/navigation";

export default function WatchingPage() {
  return (
      <div className="mx-auto w-full max-w-4xl py-2">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">Watching</h1>
        <p className="mt-2 text-sm text-neutral-500">The companies you follow in your workspace.</p>
        <div className="mt-7 divide-y divide-neutral-200 dark:divide-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800">
          {WATCHED_COMPANIES.map(company => (
            <section key={company.id} id={company.id} className="flex scroll-mt-6 items-center gap-3 px-5 py-5 target:bg-neutral-100 dark:target:bg-neutral-800/60 first:rounded-t-xl last:rounded-b-xl">
              <Image src={company.icon} alt="" width={32} height={32} className="size-8 rounded-lg object-cover" />
              <h2 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{company.name}</h2>
              <span className="ml-auto text-xs text-neutral-500">Watching</span>
            </section>
          ))}
        </div>
      </div>
  );
}

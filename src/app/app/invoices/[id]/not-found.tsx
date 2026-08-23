import Link from "next/link";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h2 className="text-xl font-semibold">Not found</h2>
      <p className="mt-2 text-sm text-neutral-500">This invoice doesn&apos;t exist or belongs to another account.</p>
      <Link href="/app/invoices" className={`${btn.secondary} mt-5`}>Back to invoices</Link>
    </div>
  );
}

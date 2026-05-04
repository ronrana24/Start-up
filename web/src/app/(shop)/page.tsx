import { HomeCatalog } from "@presentation/features/home-catalog";
import { HomeLanding } from "@presentation/features/home-landing";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <HomeLanding />
      <section id="catalog" className="scroll-mt-6 lg:scroll-mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-2xl font-bold text-heading">From the catalog</h2>
          <Link
            href="/catalog"
            className="text-sm font-semibold text-primary hover:underline"
          >
            View full catalog
          </Link>
        </div>
        <HomeCatalog showIntro={false} />
      </section>
    </>
  );
}

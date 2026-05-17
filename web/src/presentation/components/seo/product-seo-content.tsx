import type { Product } from "@domain/product";
import {
  productFeatureBullets,
  productFaqs,
  productLongTailKeywords,
  productPrimaryKeyword,
  productSeoIntro,
  productSecondaryKeywords,
  productUseCases,
} from "@presentation/lib/seo-content";
import { categoryPath } from "@presentation/lib/product-url";
import Link from "next/link";

export function ProductSeoContent({ product }: { product: Product }) {
  const faqs = productFaqs(product);
  const category = product.brand ?? "Disposable Products";
  const keywords = [
    productPrimaryKeyword(product),
    ...productSecondaryKeywords(product).slice(0, 4),
    ...productLongTailKeywords(product).slice(0, 3),
  ];

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-28 pt-4 text-heading lg:pb-10">
      <div className="rounded-2xl border border-default bg-card p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          Commercial buying guide
        </p>
        <h2 className="mt-2 text-xl font-bold">
          {product.title} for bulk business procurement
        </h2>
        <p className="mt-3 text-sm leading-7 text-secondary">
          {productSeoIntro(product)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={categoryPath(category)}
            className="rounded-full border border-primary/20 bg-primary-light px-3 py-1 text-xs font-bold text-primary"
          >
            More in {category}
          </Link>
          {keywords.slice(0, 5).map((keyword) => (
            <span
              key={keyword}
              className="rounded-full border border-default bg-secondary-bg px-3 py-1 text-xs font-semibold text-secondary"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-default bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">Key product details</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-secondary">
            {productFeatureBullets(product).map((feature) => (
              <li key={feature} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-default bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">Best-fit use cases</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-secondary">
            {productUseCases(product).map((useCase) => (
              <li key={useCase} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{useCase}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-default bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Frequently asked questions</h2>
        <div className="mt-4 divide-y divide-default">
          {faqs.map((faq) => (
            <details key={faq.question} className="group py-3">
              <summary className="cursor-pointer list-none text-sm font-bold text-heading">
                {faq.question}
              </summary>
              <p className="mt-2 text-sm leading-6 text-secondary">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

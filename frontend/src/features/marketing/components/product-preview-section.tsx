import { ProductShowcaseFrame } from "./showcase/product-showcase-frame";

export function ProductPreviewSection() {
  return (
    <section
      id="product"
      aria-labelledby="product-heading"
      className="scroll-mt-16 px-4 pb-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id="product-heading"
          className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          A live look at TeamOS
        </h2>

        <p className="mt-3 text-muted-foreground">
          Real product UI, shown here with representative workspace data.
        </p>
      </div>

      <div className="mt-10">
        <ProductShowcaseFrame />
      </div>
    </section>
  );
}

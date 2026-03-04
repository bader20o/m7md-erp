"use client";

import Link from "next/link";

type ServiceCardProps = {
  title: string;
  description?: string | null;
  duration: string;
  price?: number | string | null;
  image?: string | null;
  carType?: string | null;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
};

const fallbackImage =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 450'><rect width='800' height='450' fill='%23d8ecff'/><rect x='40' y='40' width='720' height='370' rx='24' fill='%23b6d8ff'/><path d='M120 300h560' stroke='%23205ea8' stroke-width='20' stroke-linecap='round'/><circle cx='240' cy='320' r='46' fill='%23205ea8'/><circle cx='560' cy='320' r='46' fill='%23205ea8'/></svg>";

function parsePrice(price: number | string | null | undefined): number | null {
  if (price === null || price === undefined || price === "") {
    return null;
  }

  const numericPrice = typeof price === "number" ? price : Number(price);
  if (Number.isNaN(numericPrice)) {
    return null;
  }

  return numericPrice;
}

function normalizeBadgeLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

function ServiceCardInner({
  title,
  description,
  duration,
  price,
  image,
  carType,
  selected = false
}: Omit<ServiceCardProps, "href" | "onClick" | "className">): React.ReactElement {
  const numericPrice = parsePrice(price);
  const fixedPrice = numericPrice !== null && numericPrice > 0 ? numericPrice : null;
  const hasFixedPrice = fixedPrice !== null;
  const carTypeBadge = normalizeBadgeLabel(carType);

  return (
    <>
      <div className="aspect-[16/9] overflow-hidden rounded-t-xl bg-slate-100">
        <img
          src={image || fallbackImage}
          alt={title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {carTypeBadge ? (
            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em] text-sky-700">
              {carTypeBadge}
            </span>
          ) : null}
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
            {duration}
          </span>
          {selected ? (
            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
              Selected
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold leading-tight text-slate-900">{title}</h3>
          {description ? <p className="text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>

        <div className="mt-auto">
          {hasFixedPrice ? (
            <p className="text-sm font-semibold text-sky-800">{`JOD ${fixedPrice.toFixed(2)}`}</p>
          ) : (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              Price after inspection
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export function ServiceCard({
  title,
  description,
  duration,
  price,
  image,
  carType,
  href,
  onClick,
  selected = false,
  className
}: ServiceCardProps): React.ReactElement {
  const baseClassName = [
    "group h-full overflow-hidden rounded-2xl border bg-white text-left shadow-[0_18px_40px_-28px_rgba(17,94,169,0.45)] transition duration-200",
    selected
      ? "border-sky-200 ring-2 ring-sky-500 shadow-[0_22px_48px_-30px_rgba(14,116,144,0.45)]"
      : "border-sky-100 hover:-translate-y-1 hover:shadow-[0_28px_60px_-26px_rgba(17,94,169,0.55)]",
    className ?? ""
  ]
    .join(" ")
    .trim();

  const content = (
    <ServiceCardInner
      title={title}
      description={description}
      duration={duration}
      price={price}
      image={image}
      carType={carType}
      selected={selected}
    />
  );

  if (href) {
    return (
      <Link href={href} className={baseClassName}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} className={baseClassName}>
        {content}
      </button>
    );
  }

  return <article className={baseClassName}>{content}</article>;
}

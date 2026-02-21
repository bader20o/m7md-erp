export function AdminPlaceholder({
  title,
  description
}: {
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </section>
  );
}


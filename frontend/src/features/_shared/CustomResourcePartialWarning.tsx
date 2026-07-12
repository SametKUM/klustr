export function CustomResourcePartialWarning({
  errors,
}: {
  errors: Record<string, string>;
}) {
  const contexts = Object.keys(errors);
  if (contexts.length === 0) return null;
  return (
    <div className="border-b border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
      Partial results: watch failed for {contexts.join(", ")}.
    </div>
  );
}

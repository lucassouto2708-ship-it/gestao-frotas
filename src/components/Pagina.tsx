import Link from "next/link";

export function Pagina({ titulo, voltar, children }: { titulo: string; voltar?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      {voltar && (
        <Link href={voltar} className="mb-2 inline-block text-sm text-slate-500 hover:text-marca">
          ← Voltar
        </Link>
      )}
      <h1 className="mb-5 text-2xl font-bold">{titulo}</h1>
      {children}
    </main>
  );
}

import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestão de Frotas",
  description: "Controle de quilometragem, viagens, manutenção e pneus da frota",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Frotas", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1E4E8C",
  width: "device-width",
  initialScale: 1,
};

// Aplica o tema antes da primeira pintura (evita "piscar" ao abrir no escuro)
const scriptTema = `try{var t=localStorage.getItem("tema");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

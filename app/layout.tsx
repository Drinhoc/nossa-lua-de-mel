import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Nossa Lua de Mel · Pedro & Mariana", description: "Mesmos lugares. Infinitas memórias. Buenos Aires, Ushuaia e El Calafate · Setembro de 2026.", referrer:"no-referrer",robots:{index:false,follow:false}, icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR"><body>{children}</body></html>}

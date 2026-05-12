import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLIND — drand × Stellar",
  description: "A coin flip you didn't make. Drand opens and closes a trade for you, on Stellar testnet.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const paletteBootstrap = `
try {
  var validP = ['noir','paper','terminal','midnight','rust','mono','kodak','vapor','fjord','forest'];
  var p = localStorage.getItem('blind.palette');
  if (validP.indexOf(p) < 0) p = 'noir';
  document.documentElement.dataset.palette = p;
} catch (e) {
  document.documentElement.dataset.palette = 'noir';
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: paletteBootstrap }} />
      </head>
      <body className="bg-noir min-h-screen">{children}</body>
    </html>
  );
}

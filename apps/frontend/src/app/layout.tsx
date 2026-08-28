import type { Metadata } from "next";
import { TRPCReactProvider } from "@/lib/trpc/client";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "みちナビ",
    template: "%s | みちナビ",
  },
  description:
    "地域の道路状況と避難の選択肢を、家族と一緒に確認する防災ナビゲーション。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}

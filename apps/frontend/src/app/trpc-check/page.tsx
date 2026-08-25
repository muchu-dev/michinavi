"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";

export default function TRPCCheckPage() {
  const [message, setMessage] = useState("michinavi");

  const ping = api.health.ping.useQuery();
  const echo = api.health.echo.useQuery({ message });
  const shout = api.health.shout.useMutation();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-8 font-mono text-sm">
      <h1 className="font-sans text-2xl font-semibold">tRPC 疎通確認</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-sans font-medium">health.ping（入力なし query）</h2>
        <pre className="overflow-x-auto rounded bg-black/[.06] p-3 dark:bg-white/[.08]">
          {ping.isPending
            ? "loading..."
            : ping.error
              ? `error: ${ping.error.message}`
              : `ok: ${ping.data.ok}\nserverTime: ${ping.data.serverTime.toISOString()}\ninstanceof Date: ${ping.data.serverTime instanceof Date}`}
        </pre>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-sans font-medium">health.echo（入力あり query）</h2>
        <input
          className="rounded border border-black/[.12] px-3 py-2 dark:border-white/[.16]"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <pre className="overflow-x-auto rounded bg-black/[.06] p-3 dark:bg-white/[.08]">
          {echo.isPending
            ? "loading..."
            : echo.error
              ? `error: ${echo.error.message}`
              : JSON.stringify(echo.data, null, 2)}
        </pre>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-sans font-medium">health.shout（mutation）</h2>
        <button
          type="button"
          className="w-fit rounded-full bg-foreground px-5 py-2 text-background disabled:opacity-50"
          disabled={shout.isPending}
          onClick={() => shout.mutate({ message })}
        >
          {shout.isPending ? "送信中..." : "実行"}
        </button>
        <pre className="overflow-x-auto rounded bg-black/[.06] p-3 dark:bg-white/[.08]">
          {shout.error
            ? `error: ${shout.error.message}`
            : shout.data
              ? JSON.stringify(shout.data, null, 2)
              : "未実行"}
        </pre>
      </section>
    </main>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { Button, Spinner } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";

type Msg = { role: "user" | "assistant"; content: string };
const KEY = "bledify:assistant";
const SUGGESTIONS: DictKey[] = ["ai_s1", "ai_s2", "ai_s3", "ai_s4", "ai_s5"];

export default function Assistant() {
  const { t } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<DictKey | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // keep the conversation on this phone between visits
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || "[]") as Msg[]; if (saved.length) queueMicrotask(() => setMsgs(saved)); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-30))); } catch { /* ignore */ }
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setErr(null); setInput("");
    const history: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        setErr((j.error as DictKey) || "error");
        setMsgs(history.slice(0, -1));
        setInput(q);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...history, { role: "assistant", content: acc }]);
      }
    } catch {
      setErr("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={`✨ ${t("ai_assistant")}`} action={msgs.length ? (
        <Button size="sm" variant="ghost" onClick={() => { setMsgs([]); setErr(null); }}>{t("ai_new_chat")}</Button>
      ) : undefined} />
      <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
        <div className="flex-1 space-y-3 p-4">
          <Bubble role="assistant" text={t("ai_hello")} />
          {msgs.length === 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {SUGGESTIONS.map((k) => (
                <button key={k} onClick={() => send(t(k))} className="rounded-full border border-line bg-surface px-3 py-1.5 text-start text-sm hover:border-brand">
                  {t(k)}
                </button>
              ))}
            </div>
          ) : null}
          {msgs.map((m, i) => (
            m.role === "assistant" && !m.content && busy
              ? <div key={i} className="flex items-center gap-2 text-sm text-muted"><Spinner /> {t("ai_working")}</div>
              : <Bubble key={i} role={m.role} text={m.content} />
          ))}
          {err ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-danger" role="alert">{t(err)}</p> : null}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(input); }}
          className="sticky bottom-16 border-t border-line bg-sand/95 p-3 backdrop-blur">
          <div className="flex items-end gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} dir="auto"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              placeholder={t("ai_placeholder")} aria-label={t("ai_placeholder")}
              className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-brand" />
            <Button type="submit" disabled={busy || !input.trim()} aria-label={t("ai_send")} className="shrink-0 px-3">
              <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">{t("ai_disclaimer")}</p>
        </form>
      </div>
    </>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div dir="auto" className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${mine ? "rounded-ee-md bg-brand text-white" : "rounded-es-md border border-line bg-surface"}`}>
        {text}
      </div>
    </div>
  );
}

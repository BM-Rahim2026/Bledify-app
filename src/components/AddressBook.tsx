"use client";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { normalizePhone } from "@/lib/format";
import { WILAYAS, wilayaLabel, wilayaValue } from "@/lib/wilayas";
import { ADDRESS_LABELS, deleteAddress, emptyAddress, listAddresses, makeDefault, saveAddress, type Address, type AddressDraft } from "@/lib/addresses";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import type { DictKey } from "@/lib/i18n/dict";

const LABEL_ICON: Record<string, string> = { home: "home", work: "store", family: "heart", other: "map" };

/** One address on a line: "Bir El Djir, Oran · Cité 200 logts". */
export function AddressLine({ a }: { a: Pick<Address, "wilaya" | "commune" | "address"> }) {
  const { lang } = useI18n();
  return <>{a.commune}, {wilayaLabel(a.wilaya, lang).replace(/^\d+ - /, "")}{a.address ? ` · ${a.address}` : ""}</>;
}

export function AddressLabelText({ label }: { label: string }) {
  const { t } = useI18n();
  return <span className="inline-flex items-center gap-1"><Icon name={LABEL_ICON[label] ?? "map"} className="h-4 w-4 text-brand" />{t(`addr_label_${label}` as DictKey)}</span>;
}

/** Add / edit form. Validates the phone, shows a pop-up when saved. */
export function AddressForm({ initial, onSaved, onCancel }: { initial: AddressDraft; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const { t, lang } = useI18n();
  const [d, setD] = useState<AddressDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof AddressDraft>(k: K, v: AddressDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      setErr(null);
      const phone = normalizePhone(d.phone);
      if (!phone) { setErr(t("err_phone")); return; }
      setBusy(true);
      const { row, error } = await saveAddress({ ...d, phone });
      setBusy(false);
      if (!row) { const m = t(error === "TOO_MANY_ADDRESSES" ? "addr_too_many" : "error"); setErr(m); toast(m, "error"); return; }
      toast(t("addr_saved"));
      onSaved(row);
    }}>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("addr_label")}>
        {ADDRESS_LABELS.map((k) => (
          <label key={k} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold ${d.label === k ? "border-brand bg-brand text-white" : "border-line bg-surface"}`}>
            <input type="radio" name="addr-label" className="sr-only" checked={d.label === k} onChange={() => set("label", k)} />
            {t(`addr_label_${k}` as DictKey)}
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("addr_recipient")}><Input required minLength={2} maxLength={80} autoComplete="name" value={d.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
        <Field label={t("phone")}><Input required type="tel" inputMode="tel" dir="ltr" autoComplete="tel" placeholder="0661 23 45 67" value={d.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label={t("wilaya")}>
          <Select required value={d.wilaya} onChange={(e) => set("wilaya", e.target.value)}>
            <option value="">{t("choose_wilaya")}</option>
            {WILAYAS.map((w) => <option key={w.code} value={wilayaValue(w)}>{wilayaLabel(wilayaValue(w), lang)}</option>)}
          </Select>
        </Field>
        <Field label={t("commune")}><Input required maxLength={80} autoComplete="address-level2" value={d.commune} onChange={(e) => set("commune", e.target.value)} /></Field>
      </div>
      <Field label={t("address")} hint={t("addr_address_hint")}><Input maxLength={300} autoComplete="street-address" value={d.address} onChange={(e) => set("address", e.target.value)} /></Field>
      {err ? <p className="text-sm text-danger" role="alert">{err}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? t("sending") : t("addr_save")}</Button>
        {onCancel ? <Button type="button" variant="secondary" onClick={onCancel}>{t("cancel")}</Button> : null}
      </div>
    </form>
  );
}

/** Account page: the delivery addresses, add / edit / delete / make default. */
export function AddressBook({ defaults }: { defaults: Partial<AddressDraft> }) {
  const { t } = useI18n();
  const [list, setList] = useState<Address[] | null>(null);
  const [edit, setEdit] = useState<AddressDraft | null>(null);
  const load = useCallback(() => listAddresses().then(setList), []);
  useEffect(() => { void load(); }, [load]);

  if (!list) return <Card><Spinner /></Card>;
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("addr_title")}</h2>
        {edit ? null : <Button size="sm" variant="secondary" onClick={() => setEdit(emptyAddress({ ...defaults, label: list.length ? "other" : "home" }))}>+ {t("addr_add")}</Button>}
      </div>
      {list.length === 0 && !edit ? <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">{t("addr_empty")}</p> : null}
      <ul className="space-y-2">
        {list.map((a) => edit?.id === a.id ? null : (
          <li key={a.id} className={`rounded-2xl border p-3 ${a.is_default ? "border-brand bg-brand-soft/40" : "border-line"}`}>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <AddressLabelText label={a.label} />
              {a.is_default ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] text-white">{t("addr_default")}</span> : null}
            </div>
            <p className="mt-1 text-sm">{a.full_name} · <span dir="ltr">{a.phone}</span></p>
            <p className="text-sm text-muted"><AddressLine a={a} /></p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEdit(a)}>{t("edit")}</Button>
              {a.is_default ? null : (
                <Button size="sm" variant="ghost" onClick={async () => { if (await makeDefault(a.id)) { toast(t("addr_default_set")); await load(); } }}>{t("addr_make_default")}</Button>
              )}
              <Button size="sm" variant="danger" onClick={async () => {
                if (!confirm(t("addr_delete_confirm"))) return;
                if (await deleteAddress(a.id)) { toast(t("addr_deleted")); await load(); } else toast(t("error"), "error");
              }}>{t("delete")}</Button>
            </div>
          </li>
        ))}
      </ul>
      {edit ? (
        <div className="rounded-2xl border border-brand/40 bg-surface p-3">
          <p className="mb-2 font-semibold">{edit.id ? t("addr_edit") : t("addr_add")}</p>
          <AddressForm initial={edit} onCancel={() => setEdit(null)} onSaved={async () => { setEdit(null); await load(); }} />
        </div>
      ) : null}
    </Card>
  );
}

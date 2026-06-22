import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Folder,
  FileIcon,
  ChevronRight,
  Download,
  ExternalLink,
  RefreshCw,
  HardDrive,
  Home,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  listStorageFiles,
  getStorageSignedUrl,
  type StorageEntry,
} from "@/lib/storage-browser.functions";
import { useLanguage } from "@/lib/language-context";

export const Route = createFileRoute("/staff/storage")({
  component: StorageBrowserPage,
});

const BUCKETS = [
  { id: "training-attachments", labelTh: "ไฟล์การอบรม", labelEn: "Training attachments" },
  { id: "avatars", labelTh: "รูปโปรไฟล์", labelEn: "Avatars" },
] as const;

function formatBytes(n: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(s: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function StorageBrowserPage() {
  const { t } = useLanguage();
  const [bucket, setBucket] = useState<(typeof BUCKETS)[number]["id"]>("training-attachments");
  const [prefix, setPrefix] = useState("");

  const list = useServerFn(listStorageFiles);
  const sign = useServerFn(getStorageSignedUrl);

  const query = useQuery({
    queryKey: ["staff-storage", bucket, prefix],
    queryFn: () => list({ data: { bucket, prefix } }),
  });

  const signMut = useMutation({
    mutationFn: (v: { path: string; download: boolean }) =>
      sign({ data: { bucket, path: v.path, download: v.download } }),
    onSuccess: ({ url }, vars) => {
      if (vars.download) {
        const a = document.createElement("a");
        a.href = url;
        a.click();
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to sign URL"),
  });

  const segments = prefix ? prefix.split("/") : [];

  function openFolder(entry: StorageEntry) {
    setPrefix(entry.path);
  }
  function goTo(idx: number) {
    setPrefix(segments.slice(0, idx + 1).join("/"));
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-900">
            <HardDrive className="h-6 w-6" />
            {t({ th: "เบราว์เซอร์ไฟล์ Storage", en: "Storage Browser" })}
          </h1>
          <p className="mt-1 text-sm text-warm-600">
            {t({
              th: "ตรวจสอบไฟล์จริงใน bucket พร้อมเปิด/ดาวน์โหลดด้วยลิงก์เซ็นชั่วคราว",
              en: "Inspect actual files in storage buckets with signed open/download links",
            })}
          </p>
        </div>
        <button
          onClick={() => query.refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-warm-300 bg-white px-3 py-2 text-sm font-medium text-navy-900 hover:bg-warm-50"
        >
          <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          {t({ th: "รีเฟรช", en: "Refresh" })}
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              setBucket(b.id);
              setPrefix("");
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              bucket === b.id
                ? "bg-magenta-500 text-white"
                : "bg-white text-navy-900 border border-warm-300 hover:bg-warm-50"
            }`}
          >
            {t({ th: b.labelTh, en: b.labelEn })}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-md border border-warm-200 bg-white px-3 py-2 text-sm">
        <button
          onClick={() => setPrefix("")}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-navy-900 hover:bg-warm-100"
        >
          <Home className="h-3.5 w-3.5" />
          {bucket}
        </button>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center">
            <ChevronRight className="h-3.5 w-3.5 text-warm-400" />
            <button
              onClick={() => goTo(i)}
              className="rounded px-2 py-1 text-navy-900 hover:bg-warm-100"
            >
              {seg}
            </button>
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-warm-200 bg-white">
        {query.isLoading ? (
          <div className="p-8 text-center text-sm text-warm-600">
            {t({ th: "กำลังโหลด…", en: "Loading…" })}
          </div>
        ) : query.isError ? (
          <div className="flex items-center gap-2 p-6 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {(query.error as Error)?.message}
          </div>
        ) : !query.data?.entries.length ? (
          <div className="p-8 text-center text-sm text-warm-600">
            {t({ th: "ไม่มีไฟล์ในโฟลเดอร์นี้", en: "No files in this folder" })}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-warm-50 text-left text-xs uppercase tracking-wider text-warm-600">
              <tr>
                <th className="px-4 py-2">{t({ th: "ชื่อ", en: "Name" })}</th>
                <th className="px-4 py-2">{t({ th: "ขนาด", en: "Size" })}</th>
                <th className="px-4 py-2">{t({ th: "ชนิด", en: "Type" })}</th>
                <th className="px-4 py-2">{t({ th: "แก้ไขล่าสุด", en: "Updated" })}</th>
                <th className="px-4 py-2 text-right">{t({ th: "การกระทำ", en: "Actions" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {query.data.entries.map((e) => (
                <tr key={e.path} className="hover:bg-warm-50">
                  <td className="px-4 py-2">
                    {e.isFolder ? (
                      <button
                        onClick={() => openFolder(e)}
                        className="inline-flex items-center gap-2 font-medium text-navy-900 hover:text-magenta-500"
                      >
                        <Folder className="h-4 w-4 text-amber-500" />
                        {e.name}/
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-navy-900">
                        <FileIcon className="h-4 w-4 text-warm-500" />
                        {e.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-warm-700">{e.isFolder ? "—" : formatBytes(e.size)}</td>
                  <td className="px-4 py-2 text-warm-700">{e.isFolder ? "folder" : e.mimetype ?? "—"}</td>
                  <td className="px-4 py-2 text-warm-700">{formatDate(e.updatedAt ?? e.createdAt)}</td>
                  <td className="px-4 py-2">
                    {!e.isFolder && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => signMut.mutate({ path: e.path, download: false })}
                          disabled={signMut.isPending}
                          className="inline-flex items-center gap-1 rounded border border-warm-300 px-2 py-1 text-xs font-medium text-navy-900 hover:bg-warm-100"
                          title={t({ th: "เปิดในแท็บใหม่", en: "Open in new tab" })}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {t({ th: "เปิด", en: "Open" })}
                        </button>
                        <button
                          onClick={() => signMut.mutate({ path: e.path, download: true })}
                          disabled={signMut.isPending}
                          className="inline-flex items-center gap-1 rounded bg-magenta-500 px-2 py-1 text-xs font-medium text-white hover:bg-magenta-600"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {t({ th: "ดาวน์โหลด", en: "Download" })}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-warm-500">
        {t({
          th: "ลิงก์จะหมดอายุใน 1 ชั่วโมง · แสดงสูงสุด 200 รายการต่อโฟลเดอร์",
          en: "Signed links expire in 1 hour · max 200 entries per folder",
        })}
      </p>
    </div>
  );
}

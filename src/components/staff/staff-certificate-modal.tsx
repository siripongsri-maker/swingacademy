import { useEffect } from "react";
import { X, Award, Download, QrCode, CheckCircle2 } from "lucide-react";
import seed from "@/data/seed-data.json";
import logoAsset from "@/assets/swing-academy-logo.png.asset.json";

type Props = {
  certificateId: string;
  onClose: () => void;
};

export function StaffCertificateModal({ certificateId, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sc = seed.staffConsole;
  const cert = sc.certificates.find((c) => c.id === certificateId);
  const person = cert ? sc.people.find((p) => p.id === cert.personId) : null;
  const product = cert ? sc.products.find((p) => p.id === cert.productId) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-pill bg-white/80 p-1.5 text-warm-500 hover:bg-warm-100 hover:text-navy-500"
        >
          <X className="h-4 w-4" />
        </button>

        {!cert ? (
          <div className="p-12 text-center text-sm text-warm-500">Certificate not found.</div>
        ) : (
          <>
            {/* Branded certificate face */}
            <div className="relative overflow-hidden bg-gradient-to-br from-navy-500 via-navy-500 to-magenta-700 p-10 text-white">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 80%, #fff 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-white p-1.5 shadow-md">
                      <img src={logoAsset.url} alt="SWING Academy" className="h-full w-full object-contain" />
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
                        SWING Academy
                      </p>
                      <p className="mt-0.5 text-xs text-white/60">Certificate of Completion</p>
                    </div>
                  </div>
                  <Award className="h-10 w-10 text-gold" />
                </div>

                <div className="mt-8">
                  <p className="text-xs uppercase tracking-wider text-white/60">
                    Awarded to
                  </p>
                  <p className="mt-1 text-3xl font-semibold">{person?.name ?? "—"}</p>
                  <p className="mt-0.5 text-sm text-white/70">{person?.role ?? ""}</p>
                </div>

                <div className="mt-6">
                  <p className="text-xs uppercase tracking-wider text-white/60">For completing</p>
                  <p className="mt-1 text-lg font-semibold">{product?.title ?? cert.productId}</p>
                </div>

                <div className="mt-8 grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-white/60">Issued</p>
                    <p className="mt-0.5 font-semibold">{fmt(cert.issuedDate)}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Expires</p>
                    <p className="mt-0.5 font-semibold">{fmt(cert.expiresDate)}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Status</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 font-semibold capitalize text-white">
                      <CheckCircle2 className="h-3 w-3 text-success" /> {cert.status}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer: verify code + QR */}
            <div className="flex items-center justify-between gap-4 border-b border-warm-200 px-6 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-warm-500">
                  Verify code
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-navy-500">
                  {cert.verifyCode}
                </p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-warm-100 text-warm-500">
                <QrCode className="h-10 w-10" />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4">
              <button
                onClick={onClose}
                className="rounded-pill border border-warm-200 bg-white px-4 py-2 text-sm font-semibold text-navy-500 hover:border-magenta-500"
              >
                Close
              </button>
              <button className="inline-flex items-center gap-2 rounded-pill bg-magenta-500 px-4 py-2 text-sm font-semibold text-white hover:bg-magenta-700">
                <Download className="h-4 w-4" /> Download PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

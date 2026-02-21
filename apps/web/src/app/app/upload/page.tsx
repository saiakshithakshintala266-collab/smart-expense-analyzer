"use client";

import { useMemo, useState } from "react";

type CreateUploadResponse = {
  uploadFile: {
    id: string;
    workspaceId: string;
    status: string;
    originalFileName: string;
    contentType: string;
    sizeBytes: number;
    storageBucket: string;
    storageKey: string;
    createdAt: string;
    updatedAt: string;
  };
  presignedUrl: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  expiresInSeconds: number;
};

function apiBase(): string {
  const v = process.env.NEXT_PUBLIC_UPLOAD_API_BASE ?? "http://localhost:3001";
  return v.replace(/\/+$/, "");
}

function defaultWorkspaceId(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? "ws1";
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [createResp, setCreateResp] = useState<CreateUploadResponse | null>(null);
  const [finalizeStatus, setFinalizeStatus] = useState<string | null>(null);

  const workspaceId = useMemo(() => defaultWorkspaceId(), []);

  function addLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 20));
  }

  async function onCreateUpload() {
    if (!file) return;
    setBusy(true);
    setCreateResp(null);
    setFinalizeStatus(null);

    try {
      addLog("Creating upload...");

      const res = await fetch(`${apiBase()}/workspaces/${workspaceId}/uploads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-Id": crypto.randomUUID()
        },
        body: JSON.stringify({
          originalFileName: file.name,
          contentType: file.type || guessContentType(file.name),
          sizeBytes: file.size,
          source: file.name.toLowerCase().endsWith(".csv") ? "bank_csv" : "receipt"
        })
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Create upload failed (${res.status}): ${t}`);
      }

      const json = (await res.json()) as CreateUploadResponse;
      setCreateResp(json);
      addLog(`Upload created: ${json.uploadFile.id}`);
      addLog(`Presigned URL (stub): ${json.presignedUrl}`);
    } catch (e) {
      addLog(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onFinalize() {
    if (!createResp) return;
    setBusy(true);

    try {
      addLog("Finalizing upload...");

      const res = await fetch(
        `${apiBase()}/workspaces/${workspaceId}/uploads/${createResp.uploadFile.id}/finalize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-Id": crypto.randomUUID(),
            "Idempotency-Key": crypto.randomUUID()
          },
          body: JSON.stringify({})
        }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Finalize failed (${res.status}): ${t}`);
      }

      const json = (await res.json()) as { uploadFileId: string; status: string };
      setFinalizeStatus(json.status);
      addLog(`Finalized: ${json.uploadFileId} status=${json.status}`);
    } catch (e) {
      addLog(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen glow-border">
      <div className="relative mx-auto max-w-4xl px-4 py-10">
        <div className="glass rounded-2xl p-6">
          <h1 className="text-2xl font-bold">Upload (Phase 2.4)</h1>
          <p className="mt-2 text-sm text-white/70">
            This page wires the web app to upload-service. Actual S3 upload comes in Phase 2.5.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">1) Pick a file</div>
              <input
                className="mt-3 w-full cursor-pointer rounded-xl border border-white/15 bg-white/5 p-3 text-sm"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="mt-3 text-xs text-white/60">
                Workspace: <span className="font-mono">{workspaceId}</span> • API:{" "}
                <span className="font-mono">{apiBase()}</span>
              </div>

              <button
                className="btn-primary mt-4 w-full"
                onClick={onCreateUpload}
                disabled={!file || busy}
              >
                Create Upload
              </button>

              <button
                className="btn-ghost mt-3 w-full"
                onClick={onFinalize}
                disabled={!createResp || busy}
              >
                Finalize Upload
              </button>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">2) Result</div>

              <div className="mt-3 space-y-2 text-xs text-white/70">
                <Row label="File" value={file ? `${file.name} (${file.size} bytes)` : "-"} />
                <Row label="uploadFileId" value={createResp?.uploadFile.id ?? "-"} />
                <Row label="status" value={finalizeStatus ?? createResp?.uploadFile.status ?? "-"} />
                <Row label="presignedUrl" value={createResp?.presignedUrl ?? "-"} mono />
              </div>

              <div className="mt-4 text-sm font-semibold">Log</div>
              <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
                {log.length === 0 ? (
                  <div className="text-white/50">No logs yet.</div>
                ) : (
                  <ul className="space-y-1">
                    {log.map((l, i) => (
                      <li key={i} className="font-mono">
                        {l}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-white/55">
            Tip: keep upload-service running on <span className="font-mono">:3001</span>.
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-white/50">{label}</div>
      <div className={`col-span-2 ${mono ? "font-mono" : ""} break-all`}>{value}</div>
    </div>
  );
}

function guessContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".csv")) return "text/csv";
  return "application/octet-stream";
}

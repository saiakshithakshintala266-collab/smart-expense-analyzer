"use client";

import { useMemo, useState } from "react";

type Role = "admin" | "member" | "viewer";

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

function canWrite(role: Role): boolean {
  return role === "admin" || role === "member";
}

export default function UploadPage() {
  const [role, setRole] = useState<Role>("member");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [createResp, setCreateResp] = useState<CreateUploadResponse | null>(null);
  const [uploadHttpStatus, setUploadHttpStatus] = useState<string | null>(null);
  const [finalizeStatus, setFinalizeStatus] = useState<string | null>(null);

  const workspaceId = useMemo(() => defaultWorkspaceId(), []);
  const writeAllowed = canWrite(role);

  function addLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 50));
  }

  async function createUpload(): Promise<CreateUploadResponse> {
    if (!file) throw new Error("No file selected");

    const res = await fetch(`${apiBase()}/workspaces/${workspaceId}/uploads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": crypto.randomUUID(),
        "X-Debug-Role": role
      },
      body: JSON.stringify({
        originalFileName: file.name,
        contentType: file.type || guessContentType(file.name),
        sizeBytes: file.size,
        source: file.name.toLowerCase().endsWith(".csv") ? "bank_csv" : "receipt"
      })
    });

    if (!res.ok) throw new Error(`Create upload failed (${res.status}): ${await res.text()}`);
    return (await res.json()) as CreateUploadResponse;
  }

  async function uploadToS3(presignedUrl: string, contentType: string): Promise<void> {
    if (!file) throw new Error("No file selected");

    const put = await fetch(presignedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType || "application/octet-stream"
      },
      body: file
    });

    setUploadHttpStatus(`${put.status} ${put.statusText}`);
    if (!put.ok) {
      const text = await safeReadText(put);
      throw new Error(`S3 upload failed (${put.status}): ${text || put.statusText}`);
    }
  }

  async function finalize(uploadFileId: string): Promise<{ uploadFileId: string; status: string }> {
    const res = await fetch(`${apiBase()}/workspaces/${workspaceId}/uploads/${uploadFileId}/finalize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-Id": crypto.randomUUID(),
        "Idempotency-Key": crypto.randomUUID(),
        "X-Debug-Role": role
      },
      body: JSON.stringify({})
    });

    if (!res.ok) throw new Error(`Finalize failed (${res.status}): ${await res.text()}`);
    return (await res.json()) as { uploadFileId: string; status: string };
  }

  async function onRunFullFlow() {
    if (!file) return;
    if (!writeAllowed) {
      addLog("RBAC: viewer cannot upload.");
      return;
    }

    setBusy(true);
    setCreateResp(null);
    setUploadHttpStatus(null);
    setFinalizeStatus(null);

    try {
      addLog("1) Creating upload...");
      const created = await createUpload();
      setCreateResp(created);
      addLog(`Created uploadFileId=${created.uploadFile.id}`);
      addLog(`storageKey=${created.uploadFile.storageKey}`);

      if (created.method !== "PUT") {
        throw new Error(`Unsupported presign method: ${created.method} (expected PUT)`);
      }

      addLog("2) Uploading file to S3 via presigned URL...");
      await uploadToS3(created.presignedUrl, created.uploadFile.contentType);
      addLog("S3 upload OK");

      addLog("3) Finalizing upload...");
      const fin = await finalize(created.uploadFile.id);
      setFinalizeStatus(fin.status);
      addLog(`Finalize OK: status=${fin.status}`);
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Upload (Phase 2.5.1)</h1>
              <p className="mt-2 text-sm text-white/70">
                Full flow: create → browser PUT to LocalStack S3 (presigned URL) → finalize → Dynamo updated.
              </p>
            </div>
            <RoleToggle role={role} setRole={setRole} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">Pick a file</div>
              <input
                className="mt-3 w-full cursor-pointer rounded-xl border border-white/15 bg-white/5 p-3 text-sm"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className="mt-3 text-xs text-white/60">
                Workspace: <span className="font-mono">{workspaceId}</span> • API:{" "}
                <span className="font-mono">{apiBase()}</span> • S3:{" "}
                <span className="font-mono">http://localhost:4566</span>
              </div>

              {!writeAllowed && (
                <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100/90">
                  You are <span className="font-semibold">Viewer</span>. Upload actions are disabled.
                </div>
              )}

              <button
                className="btn-primary mt-4 w-full disabled:opacity-40"
                onClick={onRunFullFlow}
                disabled={!file || busy || !writeAllowed}
              >
                Upload + Finalize
              </button>

              <div className="mt-3 text-xs text-white/55">
                If upload fails with CORS, re-run the bucket CORS command.
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-semibold">Result</div>

              <div className="mt-3 space-y-2 text-xs text-white/70">
                <Row label="Role" value={role} />
                <Row label="File" value={file ? `${file.name} (${file.size} bytes)` : "-"} />
                <Row label="uploadFileId" value={createResp?.uploadFile.id ?? "-"} mono />
                <Row label="status" value={finalizeStatus ?? createResp?.uploadFile.status ?? "-"} />
                <Row label="S3 PUT" value={uploadHttpStatus ?? "-"} />
                <Row label="storageKey" value={createResp?.uploadFile.storageKey ?? "-"} mono />
              </div>

              <div className="mt-4 text-sm font-semibold">Log</div>
              <div className="mt-2 max-h-60 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/70">
                {log.length === 0 ? (
                  <div className="text-white/50">No logs yet.</div>
                ) : (
                  <ul className="space-y-1">
                    {log.map((l, i) => (
                      <li key={`${i}-${l}`} className="font-mono">
                        {l}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-white/55">
            Run: <span className="font-mono">LocalStack</span> + <span className="font-mono">upload-service</span> +{" "}
            <span className="font-mono">web</span>.
          </div>
        </div>
      </div>
    </main>
  );
}

function RoleToggle({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-xs font-semibold text-white/70">Fake login</div>
      <div className="mt-2 flex gap-2">
        <RoleBtn current={role} value="admin" onClick={() => setRole("admin")} />
        <RoleBtn current={role} value="member" onClick={() => setRole("member")} />
        <RoleBtn current={role} value="viewer" onClick={() => setRole("viewer")} />
      </div>
    </div>
  );
}

function RoleBtn({
  current,
  value,
  onClick
}: {
  current: Role;
  value: Role;
  onClick: () => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active ? "bg-white/20 border border-white/20" : "bg-white/5 border border-white/10 hover:bg-white/10"
      }`}
      type="button"
    >
      {value}
    </button>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
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
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
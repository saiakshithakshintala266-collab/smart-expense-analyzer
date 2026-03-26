"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileImage, FileText, CheckCircle2,
  XCircle, Loader2, X, Trash2, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatFileSize, formatDate, cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { uploadsApi, transactionsApi } from "@/lib/api";
import type { UploadFile } from "@/types";

// ── Upload queue (in-session) ─────────────────────────────────────────────────

interface UploadItem {
  file: File;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  progress: number;
  uploadFile?: UploadFile;
  error?: string;
}

const STATUS_ICON: Record<UploadItem["status"], React.ReactNode> = {
  pending:    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40" />,
  uploading:  <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />,
  processing: <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />,
  done:       <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  error:      <XCircle className="w-4 h-4 text-rose-400" />,
};

const SOURCE_LABEL: Record<string, string> = {
  receipt: "Receipt / PDF",
  bank_csv: "Bank CSV",
  manual: "Manual",
};

const UPLOAD_STATUS_STYLES: Record<string, string> = {
  QUEUED:     "bg-secondary text-muted-foreground border-border",
  UPLOADED:   "bg-sky-500/10 text-sky-400 border-sky-500/20",
  PROCESSING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  COMPLETED:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  FAILED:     "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

// ── Page component ────────────────────────────────────────────────────────────

export default function UploadsPage() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [history, setHistory] = useState<UploadFile[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);  // uploadFileId being deleted
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // id waiting for confirm

  // Load upload history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await uploadsApi.list();
      const items: UploadFile[] = res.items ?? (Array.isArray(res) ? res : []);
      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistory(items);
    } catch {
      // silently ignore — history is non-critical
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleDelete(uploadFileId: string) {
    setDeleting(uploadFileId);
    setConfirmDelete(null);
    try {
      // 1. Delete all transactions from this upload (cascade)
      await transactionsApi.deleteByUpload(uploadFileId).catch(() => null);
      // 2. Delete the upload record
      await uploadsApi.delete(uploadFileId);
      setHistory((prev) => prev.filter((u) => u.id !== uploadFileId));
      toast.success("Upload and its transactions deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete upload");
    } finally {
      setDeleting(null);
    }
  }

  // ── Dropzone logic ──────────────────────────────────────────────────────────

  const update = (index: number, patch: Partial<UploadItem>) =>
    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, ...patch } : u)));

  const processFile = async (file: File, index: number) => {
    try {
      update(index, { status: "uploading", progress: 20 });
      const created = await uploadsApi.create({
        originalFileName: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        source: file.name.endsWith(".csv") ? "bank_csv" : "receipt",
      });

      update(index, { progress: 50 });
      await fetch(created.presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      update(index, { progress: 80, status: "processing" });
      await uploadsApi.finalize(created.uploadFile.id);

      update(index, { status: "done", progress: 100, uploadFile: created.uploadFile });
      toast.success(`${file.name} uploaded successfully`);

      // Refresh history so the new upload appears
      loadHistory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      update(index, { status: "error", error: message });
      toast.error(`Failed to upload ${file.name}: ${message}`);
    }
  };

  const onDrop = useCallback((accepted: File[]) => {
    const startIndex = uploads.length;
    const newItems: UploadItem[] = accepted.map((file) => ({
      file,
      status: "pending" as const,
      progress: 0,
    }));
    setUploads((prev) => [...prev, ...newItems]);
    accepted.forEach((file, i) => processFile(file, startIndex + i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploads.length]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [], "application/pdf": [], "text/csv": [] },
    maxSize: 10 * 1024 * 1024,
  });

  const removeQueueItem = (index: number) =>
    setUploads((prev) => prev.filter((_, i) => i !== index));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Upload Receipts"
        description="Drag and drop receipts, bank statements, or CSV files"
        icon={Upload}
      />

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-secondary/30"
        )}
      >
        <input {...getInputProps()} />
        <motion.div animate={{ scale: isDragActive ? 1.05 : 1 }} className="flex flex-col items-center gap-4">
          <div className={cn(
            "w-16 h-16 rounded-2xl border flex items-center justify-center transition-all",
            isDragActive ? "bg-primary/10 border-primary/40" : "bg-secondary border-border"
          )}>
            <Upload className={cn("w-7 h-7", isDragActive ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="font-semibold text-foreground text-lg">
              {isDragActive ? "Drop files here" : "Drop files or click to browse"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Supports JPEG, PNG, PDF, CSV — up to 10MB each</p>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {["Receipt photo", "Bank statement PDF", "CSV export"].map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-secondary border border-border">{t}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* In-session upload queue */}
      <AnimatePresence>
        {uploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-sm">
                Upload Queue{" "}
                <span className="ml-2 text-xs font-mono text-muted-foreground">
                  {uploads.filter((u) => u.status === "done").length}/{uploads.length} done
                </span>
              </h2>
              <button onClick={() => setUploads([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear all
              </button>
            </div>

            <div className="divide-y divide-border">
              {uploads.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                    {item.file.name.endsWith(".csv")
                      ? <FileText className="w-5 h-5 text-emerald-400" />
                      : <FileImage className="w-5 h-5 text-sky-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.file.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground font-mono">{formatFileSize(item.file.size)}</span>
                      {item.status === "error" && <span className="text-xs text-rose-400">{item.error}</span>}
                      {item.status === "uploading" && <span className="text-xs text-sky-400">Uploading to S3...</span>}
                      {item.status === "processing" && <span className="text-xs text-amber-400">Extracting transactions...</span>}
                      {item.status === "done" && <span className="text-xs text-emerald-400">Processing complete</span>}
                    </div>
                    {(item.status === "uploading" || item.status === "processing") && (
                      <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className="h-full bg-primary rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${item.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {STATUS_ICON[item.status]}
                    {item.status !== "uploading" && item.status !== "processing" && (
                      <button
                        onClick={() => removeQueueItem(i)}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload history */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Upload History
          {!historyLoading && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {history.length} {history.length === 1 ? "file" : "files"}
            </span>
          )}
        </h2>

        {historyLoading ? (
          <div className="rounded-xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-muted-foreground/50" />
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 py-10 text-center text-sm text-muted-foreground">
            No uploads yet — drop a file above to get started
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-secondary/40 border-b border-border">
              <div className="col-span-5 text-xs font-medium text-muted-foreground">File</div>
              <div className="col-span-2 text-xs font-medium text-muted-foreground">Source</div>
              <div className="col-span-2 text-xs font-medium text-muted-foreground">Status</div>
              <div className="col-span-2 text-xs font-medium text-muted-foreground">Uploaded</div>
              <div className="col-span-1" />
            </div>

            <div className="divide-y divide-border">
              {history.map((upload) => {
                const isCsvFile = upload.originalFileName?.endsWith(".csv") || upload.source === "bank_csv";
                const isDeleting = deleting === upload.id;
                const isConfirming = confirmDelete === upload.id;

                return (
                  <div key={upload.id} className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-secondary/20 transition-colors">
                    {/* File name + size */}
                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                        {isCsvFile
                          ? <FileText className="w-4 h-4 text-emerald-400" />
                          : <FileImage className="w-4 h-4 text-sky-400" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" title={upload.originalFileName}>
                          {upload.originalFileName}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatFileSize(upload.sizeBytes)}
                        </p>
                      </div>
                    </div>

                    {/* Source */}
                    <div className="col-span-2 flex items-center">
                      <span className="text-xs text-muted-foreground">
                        {SOURCE_LABEL[upload.source] ?? upload.source}
                      </span>
                    </div>

                    {/* Status badge */}
                    <div className="col-span-2 flex items-center">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full border",
                        UPLOAD_STATUS_STYLES[upload.status] ?? UPLOAD_STATUS_STYLES.QUEUED
                      )}>
                        {upload.status}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="col-span-2 flex items-center">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(upload.createdAt)}
                      </span>
                    </div>

                    {/* Delete action */}
                    <div className="col-span-1 flex items-center justify-end">
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : isConfirming ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(upload.id)}
                            className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Yes
                          </button>
                          <span className="text-muted-foreground/40">·</span>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(upload.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete upload and its transactions"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

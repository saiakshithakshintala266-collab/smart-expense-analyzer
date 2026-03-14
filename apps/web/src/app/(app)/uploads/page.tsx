"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileImage, FileText, CheckCircle2,
  XCircle, Loader2, X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatFileSize, cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { uploadsApi } from "@/lib/api";
import type { UploadFile } from "@/types";

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

export default function UploadsPage() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const update = (index: number, patch: Partial<UploadItem>) =>
    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, ...patch } : u)));

  const processFile = async (file: File, index: number) => {
    try {
      update(index, { status: "uploading", progress: 20 });
      const created = await uploadsApi.create({
        originalFileName: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        source: "receipt",
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

  const removeItem = (index: number) =>
    setUploads((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Upload Receipts"
        description="Drag and drop receipts, bank statements, or CSV files"
        icon={Upload}
      />

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
                        onClick={() => removeItem(i)}
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
    </div>
  );
}
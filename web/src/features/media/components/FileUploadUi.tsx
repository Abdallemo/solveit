"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NewuseTask } from "@/contexts/TaskContext";

import {
  useDeleteFileGeneric,
  useDownloadFile,
  useFileUpload,
} from "@/hooks/useFile";
import { cn } from "@/lib/utils/utils";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileChatCardComps } from "./FileHelpers";

interface FileUploadUiProps {
  maxFiles?: number;
  className?: string;
}

export default function FileUploadUi({ className }: FileUploadUiProps) {
  const { updateDraft, draft, setFilePreview } = NewuseTask();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const { uploadMutate } = useFileUpload({});

  const { mutateAsync: deleteFile } = useDeleteFileGeneric("draft_task");
  const { mutateAsync: downloadFile } = useDownloadFile();
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const handleFiles = async (newFiles: FileList | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles);

    setUploadingFiles((prev) => [...prev, ...fileArray]);

    try {
      const uploadedMeta = await uploadMutate({
        files: fileArray,
        url: "/tasks/draft/files",
      });

      const currentFiles = draftRef.current.uploadedFiles || [];
      updateDraft({ uploadedFiles: [...currentFiles, ...uploadedMeta] });
    } catch (err) {
      console.error(err);
      setUploadingFiles((prev) => []);
    } finally {
      setUploadingFiles((prev) => prev.filter((f) => !fileArray.includes(f)));
      inputRef.current!.value = "";
    }
  };

  const handleFileDelete = async (filePath: string) => {
    try {
      await deleteFile({
        filePath,
      });
      const filtered = (draft.uploadedFiles || []).filter(
        (f) => f.filePath !== filePath,
      );
      updateDraft({ uploadedFiles: filtered });
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete file");
    }
  };

  const handleFileDownload = async (fileName: string, key: string) => {
    toast.loading("Preparing download...", {
      id: `file-${fileName}-download`,
    });
    await downloadFile({ fileName, key });
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-md p-4 text-center",
          isDragging ? "border-primary bg-primary/5" : "border-muted",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-full bg-muted">
            <Upload className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">
            Drop files here or click to browse
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => inputRef.current?.click()}
          >
            Select Files
          </Button>
        </div>
      </div>

      {(uploadingFiles.length > 0 ||
        (draft.uploadedFiles?.length ?? 0) > 0) && (
        <ScrollArea className="h-40 py-2">
          <div className="space-y-2 h-40">
            {uploadingFiles
              .filter(
                (f) =>
                  !draft.uploadedFiles?.some(
                    (draftF) => draftF.fileName === f.name,
                  ),
              )
              .map((file) => (
                <div key={file.name} className="w-full ">
                  <FileChatCardComps
                    key={file.name}
                    loading
                    file={{
                      fileName: file.name,
                      filePath: "",
                      fileSize: file.size,
                      fileType: file.type,
                    }}
                  />
                </div>
              ))}
            {(draft.uploadedFiles || []).map((file) => (
              <div key={file.filePath} className="w-full">
                <FileChatCardComps
                  file={file}
                  action={() =>
                    setFilePreview({
                      fileName: file.fileName,
                      filePath: file.filePath,
                      fileSize: file.fileSize,
                      fileType: file.fileType,
                    })
                  }
                  deleteAction={async (f) => {
                    await handleFileDelete(f.filePath);
                  }}
                  downloadAction={async (f) =>
                    await handleFileDownload(f.fileName, f.filePath)
                  }
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

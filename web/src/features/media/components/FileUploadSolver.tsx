"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import {
  useDeleteFileGeneric,
  useDownloadFile,
  useFileUpload,
} from "@/hooks/useFile";
import { cn } from "@/lib/utils/utils";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { WorkspaceUploadedFileMeta } from "@/features/media/media-types";
import { FileChatCardComps } from "./FileHelpers";

interface FileUploadProps {
  className?: string;
}

export default function FileUploadSolver({ className }: FileUploadProps) {
  const useCurrentSolver = useCurrentUser();

  const { uploadedFiles, setUploadedFiles, currentWorkspace, setFilePreview } =
    useWorkspace();
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { uploadMutate, isUploading } = useFileUpload({});
  const { mutateAsync: downloadFile, isPending: isRequestingDownload } =
    useDownloadFile();
  const handleFileDownload = async (key: string, fileName: string) => {
    toast.loading("preparing file downlad..", {
      id: `file-${fileName}-download`,
    });
    await downloadFile({ fileName, key });
  };
  const {
    mutateAsync: deleteFile,
    isPending: isDeleting,
    isError,
  } = useDeleteFileGeneric("solution_workspace");

  const fileDisabled =
    currentWorkspace?.task.status === "SUBMITTED" ||
    currentWorkspace?.task.status === "COMPLETED";
  const uploadedById = useCurrentSolver.user?.id!;

  const handleFiles = async (newFiles: FileList | null) => {
    if (!newFiles || fileDisabled) {
      return;
    }

    const fileArray = Array.from(newFiles);

    setUploadingFiles((prev) => [...prev, ...fileArray]);

    try {
      const uploadedMeta = await uploadMutate({
        files: fileArray,
        url: `/workspaces/${currentWorkspace?.id}/files`,
      });
      const newFiles: WorkspaceUploadedFileMeta[] = uploadedMeta.map((u) => {
        return {
          ...u,
          isDraft: true,
          uploadedById: currentWorkspace?.solverId!,
          workspaceId: currentWorkspace?.id!,
          id: Math.random().toString(),
          uploadedAt: new Date(),
        };
      });
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    } catch (e) {
    } finally {
      setUploadingFiles((prev) => prev.filter((f) => !fileArray.includes(f)));
    }

    inputRef.current!.value = "";
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
          disabled={fileDisabled}
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex flex-col items-center gap-2">
          <div className="p-2 rounded-full bg-muted">
            <Upload className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">
            Drop files here or click to browse
          </div>
          <div className="text-xs text-muted-foreground">
            PDF, DOC, JPG, PNG up to 200MB • {uploadedFiles.length} files
          </div>
          <Button
            type="button"
            disabled={fileDisabled}
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => inputRef.current?.click()}
          >
            Select Files
          </Button>
        </div>
      </div>

      {(uploadingFiles.length > 0 || uploadedFiles.length > 0) && (
        <ScrollArea className="flex-1 ">
          <div className="mt-2 space-y-2 h-[100px] overflow-scroll p-2 ">
            {uploadingFiles
              .filter((f) => !uploadedFiles?.some((F) => F.fileName === f.name))
              .map((file) => (
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
              ))}
            {uploadedFiles.map((file) => (
              <div key={file.id} className="w-70">
                <FileChatCardComps
                  action={() => {
                    setFilePreview({
                      fileName: file.fileName,
                      filePath: file.filePath,
                      fileSize: file.fileSize,
                      fileType: file.fileType,
                    });
                  }}
                  key={file.id}
                  file={file}
                  deleteAction={async () => {
                    try {
                      await deleteFile({
                        filePath: file.filePath,
                        workspaceId: currentWorkspace?.id,
                      });
                      setUploadedFiles((prev) =>
                        prev.filter((f) => f.filePath !== file.filePath),
                      );
                    } catch (error) {}
                  }}
                  downloadAction={async (file) => {
                    await handleFileDownload(file.filePath, file.fileName);
                  }}
                  opt={{ deleteDisable: fileDisabled }}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

"use client";

import React, { useMemo, useCallback, useState } from "react";
import { FileText, Copy, Download, Save, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { MarkdownContent } from "../MarkdownContent/MarkdownContent";
import type { FileItem } from "../../types/types";
import styles from "./CopyFileViewDialog.module.scss";

interface CopyFileViewDialogProps {
  file: FileItem;
  onClose: () => void;
}

export const CopyFileViewDialog = React.memo<CopyFileViewDialogProps>(
  ({ file, onClose }) => {
    const [isSaved, setIsSaved] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fileExtension = useMemo(() => {
      return file.path.split(".").pop()?.toLowerCase() || "";
    }, [file.path]);

    const isMarkdown = useMemo(() => {
      return fileExtension === "md" || fileExtension === "markdown";
    }, [fileExtension]);

    const isCopyFile = useMemo(() => {
      return file.path.includes("hook") && fileExtension === "txt";
    }, [file.path, fileExtension]);

    const language = useMemo(() => {
      const languageMap: Record<string, string> = {
        js: "javascript",
        jsx: "javascript", 
        ts: "typescript",
        tsx: "typescript",
        py: "python",
        rb: "ruby",
        go: "go",
        rs: "rust",
        java: "java",
        cpp: "cpp",
        c: "c",
        cs: "csharp",
        php: "php",
        swift: "swift",
        kt: "kotlin",
        scala: "scala",
        sh: "bash",
        bash: "bash",
        zsh: "bash",
        json: "json",
        xml: "xml",
        html: "html",
        css: "css",
        scss: "scss",
        sass: "sass",
        less: "less",
        sql: "sql",
        yaml: "yaml",
        yml: "yaml",
        toml: "toml",
        ini: "ini",
        dockerfile: "dockerfile",
        makefile: "makefile",
        txt: "text",
      };
      return languageMap[fileExtension] || "text";
    }, [fileExtension]);

    const handleCopy = useCallback(() => {
      if (file.content) {
        navigator.clipboard.writeText(file.content);
      }
    }, [file.content]);

    const handleDownload = useCallback(() => {
      if (file.content) {
        const blob = new Blob([file.content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.path;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }, [file.content, file.path]);

    const handleSave = useCallback(async () => {
      setIsLoading(true);
      try {
        // Simular salvamento - mockado
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSaved(true);
        console.log("Copy salva:", file.path);
      } catch (error) {
        console.error("Erro ao salvar:", error);
      } finally {
        setIsLoading(false);
      }
    }, [file.path]);

    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className={styles.dialog}>
          <DialogTitle className="sr-only">{file.path}</DialogTitle>
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <FileText className={styles.fileIcon} />
              <span className={styles.fileName}>{file.path}</span>
            </div>
            <div className={styles.actions}>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className={styles.actionButton}
              >
                <Copy size={16} />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className={styles.actionButton}
              >
                <Download size={16} />
                Download
              </Button>
              {isCopyFile && (
                <Button
                  variant={isSaved ? "secondary" : "default"}
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaved || isLoading}
                  className={styles.saveButton}
                >
                  {isSaved ? (
                    <>
                      <Check size={16} />
                      Salva
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {isLoading ? "Salvando..." : "Salvar Copy"}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className={styles.contentArea}>
            {file.content ? (
              isMarkdown ? (
                <div className={styles.markdownWrapper}>
                  <MarkdownContent content={file.content} />
                </div>
              ) : (
                <SyntaxHighlighter
                  language={language}
                  style={oneDark}
                  customStyle={{
                    margin: 0,
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                  showLineNumbers
                >
                  {file.content}
                </SyntaxHighlighter>
              )
            ) : (
              <div className={styles.emptyContent}>
                <p>File is empty</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  },
);

CopyFileViewDialog.displayName = "CopyFileViewDialog";
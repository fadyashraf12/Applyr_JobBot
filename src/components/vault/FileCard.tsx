import React, { useState } from 'react';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
}

interface FileCardProps {
  file: DriveFile;
  onDelete: (id: string) => void;
}

export default function FileCard({ file, onDelete }: FileCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const getFileIcon = (mime: string) => {
    if (mime.includes('pdf')) return '📄';
    if (mime.includes('word') || mime.includes('officedocument.wordprocessing')) return '📝';
    if (mime.includes('image')) return '🖼️';
    if (mime.includes('folder')) return '📁';
    return '📎';
  };

  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return '—';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return '—';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (val: string) => {
    const d = new Date(val);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${file.name}?`)) {
      setIsDeleting(true);
      await onDelete(file.id);
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800/80 hover:border-slate-700/60 transition-all p-5 rounded-xl flex items-start gap-4 justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-3xl bg-slate-950 p-2.5 rounded-lg border border-slate-850/80 shrink-0 select-none">
          {getFileIcon(file.mimeType)}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="font-bold text-white text-sm break-all leading-tight">
            {file.name}
          </p>
          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-mono">
            <span>{formatSize(file.size)}</span>
            <span>•</span>
            <span>Modified: {formatDate(file.modifiedTime)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 shrink-0">
        <a
          href={`https://drive.google.com/file/d/${file.id}/view`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 px-3 inline-flex items-center justify-center rounded bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:text-white text-xs font-semibold text-slate-350 transition-colors"
        >
          View
        </a>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-8 w-8 inline-flex items-center justify-center rounded bg-red-950/20 hover:bg-red-900/10 border border-red-900/25 hover:text-red-300 text-red-400 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          aria-label="Delete file"
        >
          {isDeleting ? '...' : '✕'}
        </button>
      </div>
    </div>
  );
}

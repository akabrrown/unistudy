'use client'

import { useState, useRef } from 'react'
import { UploadCloud, FileText, Trash2, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api/client'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface UploadLectureDialogProps {
  courseId: string
  courseCode: string
}

export function UploadLectureDialog({ courseId, courseCode }: UploadLectureDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [fileWeeks, setFileWeeks] = useState<Record<number, string>>({});

  const supabase = createClient()
  const router = useRouter()

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setCurrentUploadIndex(i);
      setUploadProgress(0);

      try {
        const fileWeek = fileWeeks[i];
        const payload: any = {
          course_id: courseId,
          title: file.name
        };
        if (fileWeek) {
          payload.week = parseInt(fileWeek);
        }
        
        // Insert lecture placeholder
        const newLecture = await apiFetch('/lectures', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        // 1. Upload the original file to Cloudinary
        const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        if (!uploadPreset) throw new Error('Cloudinary upload preset is not configured.');

        const formDataCloudinary = new FormData();
        formDataCloudinary.append('file', file);
        formDataCloudinary.append('upload_preset', uploadPreset);
        const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/auto/upload`;

        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(e.loaded);
        };

        const responsePromise = new Promise<any>((resolve, reject) => {
          xhr.onload = () => {
            try {
              const json = JSON.parse(xhr.responseText);
              if (xhr.status >= 200 && xhr.status < 300) resolve(json);
              else reject(new Error(json.error?.message || 'Upload failed'));
            } catch (err) {
              reject(err);
            }
          };
          xhr.onerror = () => reject(new Error('Network error'));
        });

        xhr.send(formDataCloudinary);
        const fileData = await responsePromise;

        // Update lecture with Cloudinary URL and set processing to true
        await apiFetch(`/lectures/${newLecture.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ file_url: fileData.secure_url, processing: true })
        });

        // 2. Send file to FastAPI conversion endpoint
        setIsProcessing(true);
        const formDataFastAPI = new FormData();
        formDataFastAPI.append('file', file);
        formDataFastAPI.append('lecture_id', newLecture.id);
        const userRes = await supabase.auth.getUser();
        const userId = userRes.data.user?.id || '';
        formDataFastAPI.append('user_id', userId);

        const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';
        const convertRes = await fetch(`${fastapiUrl}/convert`, {
          method: 'POST',
          headers: {
            'X-Converter-Secret': process.env.NEXT_PUBLIC_CONVERTER_SECRET || '',
          },
          body: formDataFastAPI,
        });

        if (!convertRes.ok) {
          const errText = await convertRes.text();
          throw new Error(`Conversion failed: ${errText}`);
        }
        
        setIsProcessing(false);
        successCount++;
      } catch (err: any) {
        console.error(`Upload error for ${file.name}:`, err);
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
        failCount++;
        setIsProcessing(false);
      }
    }

    setIsUploading(false);
    setSelectedFiles([]);
    setFileWeeks({});
    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} file(s)`);
      setIsOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Button onClick={() => setIsOpen(true)}>
        <Plus size={16} className="mr-2" />
        Add Materials
      </Button>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Upload Lecture to {courseCode}
          </DialogTitle>
          <DialogDescription>
            Upload a PDF of your lecture slides. We will extract the content and prepare it for AI processing.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-6">
          <div
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors bg-muted/30 ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50 border-border'}`}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (isUploading) return;
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                setSelectedFiles(prev => [...prev, ...files].slice(0, 10)); // limit to 10
              }
            }}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
              <UploadCloud size={24} />
            </div>
            <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
            <p className="text-xs text-muted-foreground">PDF / PPTX files (up to 10 at once)</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf,.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation,.ppt,application/vnd.ms-powerpoint"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const files = Array.from(e.target.files);
                  setSelectedFiles(prev => [...prev, ...files].slice(0, 10));
                  e.target.value = '';
                }
              }}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="max-h-[250px] overflow-y-auto space-y-2 mt-4 pr-1">
              {isUploading && (
                <p className="text-sm font-semibold text-primary mb-2">
                  Uploading {currentUploadIndex + 1} of {selectedFiles.length}...
                </p>
              )}
              {selectedFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="flex items-center gap-3 p-3 border border-border rounded-xl bg-card shadow-sm relative group">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-semibold text-foreground truncate pr-2">{file.name}</p>
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Lecture Week (optional):</span>
                      <input 
                        type="number" 
                        min="1" max="52" 
                        placeholder="e.g. 1"
                        value={fileWeeks[idx] || ''}
                        onChange={(e) => setFileWeeks(prev => ({ ...prev, [idx]: e.target.value }))}
                        disabled={isUploading}
                        className="w-20 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </div>
                    {isUploading && currentUploadIndex === idx && (
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${Math.round((uploadProgress / file.size) * 100)}%` }}
                        />
                      </div>
                    )}
                    {isUploading && currentUploadIndex > idx && (
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className="bg-green-500 h-full rounded-full w-full" />
                      </div>
                    )}
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading || isProcessing}
          >
            {(isUploading || isProcessing) ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                {isProcessing ? 'Processing...' : 'Uploading...'}
              </>
            ) : (
              'Upload Selected'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

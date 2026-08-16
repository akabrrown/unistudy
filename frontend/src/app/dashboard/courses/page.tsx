'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Plus, UploadCloud, BookOpen, Trash2, Loader2, FileText, Edit3, Archive, ArchiveRestore } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

export default function CoursesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [isCourseDialogOpen, setIsCourseDialogOpen] = useState(false)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [fileWeeks, setFileWeeks] = useState<Record<number, string>>({});

  
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseColor, setNewCourseColor] = useState('#5B2D8E');
  const [newCourseSemester, setNewCourseSemester] = useState('1');
  const [newCourseYear, setNewCourseYear] = useState(new Date().getFullYear().toString());

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseColor, setEditCourseColor] = useState('#5B2D8E');
  const [editCourseSemester, setEditCourseSemester] = useState('1');
  const [editCourseYear, setEditCourseYear] = useState('');

  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    try {
      const data = await apiFetch('/courses')
      setCourses(data || []);
      console.log('Fetched courses:', data || []);
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteCourse = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if(confirm('Are you sure you want to delete this course?')) {
      const previousCourses = [...courses]
      setCourses(courses.filter(c => c.id !== id))
      
      try {
        await apiFetch(`/courses/${id}`, { method: 'DELETE' })
        toast.success('Course deleted')
      } catch (err: any) {
        setCourses(previousCourses)
        toast.error(err.message)
      }
    }
  }

  const handleAddCourse = async () => {
    if (!newCourseCode || !newCourseName) {
      toast.error("Please provide both a course code and a name.")
      return
    }
    
    try {
      const colour = newCourseColor || '#5B2D8E';
      const newCourseData = {
        course_code: newCourseCode.toUpperCase(),
        title: newCourseName,
        colour,
        semester: parseInt(newCourseSemester) || 1,
        year: parseInt(newCourseYear) || new Date().getFullYear()
      }

      const fetchedCourse = await apiFetch('/courses', {
        method: 'POST',
        body: JSON.stringify(newCourseData)
      });
      
      setCourses(prev => [fetchedCourse, ...prev]);

      setNewCourseCode('');
      setNewCourseName('');
      setIsCourseDialogOpen(false);
      toast.success('Course added');
    } catch (err: any) {
      console.error('Unexpected error adding course:', err);
      toast.error(err.message || 'Unexpected error');
    }
  }

  const openEditDialog = (e: React.MouseEvent, course: any) => {
    e.preventDefault();
    e.stopPropagation();
    setEditCourseId(course.id);
    setEditCourseCode(course.course_code || '');
    setEditCourseName(course.title || '');
    setEditCourseColor(course.colour || '#5B2D8E');
    setEditCourseSemester(course.semester?.toString() || '1');
    setEditCourseYear(course.year?.toString() || new Date().getFullYear().toString());
    setIsEditDialogOpen(true);
  }

  const handleUpdateCourse = async () => {
    if (!editCourseId) return;
    try {
      const updatedCourse = await apiFetch(`/courses/${editCourseId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          course_code: editCourseCode.toUpperCase(),
          title: editCourseName,
          colour: editCourseColor,
          semester: parseInt(editCourseSemester) || 1,
          year: parseInt(editCourseYear) || new Date().getFullYear()
        })
      });
      setCourses(courses.map(c => c.id === editCourseId ? updatedCourse : c));
      setIsEditDialogOpen(false);
      toast.success('Course updated');
    } catch (err: any) {
      toast.error(err.message || 'Error updating course');
    }
  }

  const handleArchiveCourse = async (e: React.MouseEvent, id: string, isArchived: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const updatedCourse = await apiFetch(`/courses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_archived: !isArchived })
      });
      setCourses(courses.map(c => c.id === id ? updatedCourse : c));
      toast.success(isArchived ? 'Course restored' : 'Course archived');
    } catch (err: any) {
      toast.error(err.message || 'Error archiving course');
    }
  }

  const activeCourses = courses.filter(c => !c.is_archived && c.colour !== '#hidden');
  const archivedCourses = courses.filter(c => c.is_archived && c.colour !== '#hidden');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground">{activeCourses.length} active modules</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCourseDialogOpen} onOpenChange={setIsCourseDialogOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 py-2 gap-2 text-sm font-medium transition-colors">
              <Plus size={16} /> Add Course
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create new course</DialogTitle>
                <DialogDescription>
                  Add a new university module to organize your lectures and flashcards.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="code" className="text-right">Course Code</Label>
                  <Input id="code" placeholder="e.g. CS101" className="col-span-3" value={newCourseCode} onChange={e => setNewCourseCode(e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Course Name</Label>
                  <Input id="name" placeholder="e.g. Intro to CS" className="col-span-3" value={newCourseName} onChange={e => setNewCourseName(e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Course Colour</Label>
                  <div className="col-span-3 flex space-x-2">
                    {[
                      "#5B2D8E",
                      "#7B4DB5",
                      "#9B72CF",
                      "#E91E63",
                      "#0B57D0",
                      "#FF5722",
                      "#4CAF50"
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-6 h-6 rounded-full border-2 ${c === newCourseColor ? "border-black" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewCourseColor(c)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={handleAddCourse}>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex gap-2">
          {/* Edit Course Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Edit course</DialogTitle>
                <DialogDescription>
                  Update the details for this module.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-code" className="text-right">Course Code</Label>
                  <Input id="edit-code" placeholder="e.g. CS101" className="col-span-3" value={editCourseCode} onChange={e => setEditCourseCode(e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">Course Name</Label>
                  <Input id="edit-name" placeholder="e.g. Intro to CS" className="col-span-3" value={editCourseName} onChange={e => setEditCourseName(e.target.value)} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Course Colour</Label>
                  <div className="col-span-3 flex space-x-2">
                    {[
                      "#5B2D8E",
                      "#7B4DB5",
                      "#9B72CF",
                      "#E91E63",
                      "#0B57D0",
                      "#FF5722",
                      "#4CAF50"
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-6 h-6 rounded-full border-2 ${c === editCourseColor ? "border-black" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setEditCourseColor(c)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={handleUpdateCourse}>Save changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : activeCourses.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No active courses</h3>
            <p className="text-muted-foreground max-w-sm mt-2">Get started by adding your first course to begin organizing your study materials.</p>
          </div>
        ) : activeCourses.map(course => (
          <Card
            key={course.id}
            className="relative overflow-hidden group hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => {
              router.push(`/dashboard/courses/${course.id}`)
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: course.colour || '#5B2D8E' }} />
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">{course.course_code || 'COURSE'}</p>
                  <CardTitle className="text-xl">{course.title || 'Untitled'}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <BookOpen size={18} />
                  </div>
                  <button 
                    onClick={(e) => openEditDialog(e, course)}
                    className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center text-secondary-foreground hover:bg-secondary transition-colors z-10"
                    title="Edit Course"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button 
                    onClick={(e) => handleArchiveCourse(e, course.id, !!course.is_archived)}
                    className="w-10 h-10 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors z-10"
                    title="Archive Course"
                  >
                    <Archive size={18} />
                  </button>
                  <button 
                    onClick={(e) => deleteCourse(e, course.id)}
                    className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors z-10"
                    title="Delete Course"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mt-4 border-t pt-4">
                <div className="text-sm text-muted-foreground">{course.lectures?.length || 0} lectures</div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs px-2 gap-1"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/dashboard/courses/${course.id}/flashcards` }}
                  >
                    <BookOpen size={14} /> Cards
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs px-2 gap-1"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/dashboard/courses/${course.id}/quiz` }}
                  >
                    <BookOpen size={14} /> Quiz
                  </Button>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs px-2 gap-1"
                    onClick={(e) => { 
                      e.preventDefault(); 
                      e.stopPropagation(); 
                      setActiveCourseId(course.id); 
                      setIsUploadDialogOpen(true); 
                    }}
                  >
                    <UploadCloud size={14} /> Upload
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {archivedCourses.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight mb-6 flex items-center gap-2">
            <Archive className="w-6 h-6" /> Archived Courses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75 grayscale-[50%]">
            {archivedCourses.map(course => (
              <Card
                key={course.id}
                className="relative overflow-hidden group hover:border-primary/50 transition-colors"
              >
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: course.colour || '#5B2D8E' }} />
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">{course.course_code || 'COURSE'}</p>
                      <CardTitle className="text-xl">{course.title || 'Untitled'}</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => handleArchiveCourse(e, course.id, !!course.is_archived)}
                        className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-colors z-10"
                        title="Restore Course"
                      >
                        <ArchiveRestore size={18} />
                      </button>
                      <button 
                        onClick={(e) => deleteCourse(e, course.id)}
                        className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors z-10"
                        title="Delete Course"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mt-4 border-t pt-4">
                    <div className="text-sm text-muted-foreground">{course.lectures?.length || 0} lectures</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={(open) => {
        setIsUploadDialogOpen(open)
        if (!open) {
          setSelectedFiles([])
          setFileWeeks({})
          setActiveCourseId(null)
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Upload Lecture to {courses.find(c => c.id === activeCourseId)?.course_code}
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
                        // Clear input so selecting the same file again works
                        e.target.value = '';
                      }
                    }}
                  />
                </div>

                {/* Upload Progress & Selected File Info */}
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
            <Button variant="outline" type="button" onClick={() => setIsUploadDialogOpen(false)}>
      Cancel
    </Button>
            <Button
              disabled={selectedFiles.length === 0 || isUploading || isProcessing}
              onClick={async () => {
                if (selectedFiles.length === 0 || !activeCourseId) return;

                setIsUploading(true);
                let successCount = 0;
                let failCount = 0;

                for (let i = 0; i < selectedFiles.length; i++) {
                  const file = selectedFiles[i];
                  setCurrentUploadIndex(i);
                  setUploadProgress(0);

                  const isPpt = file.name.toLowerCase().endsWith('.ppt') ||
                                file.name.toLowerCase().endsWith('.pptx');

                  try {
                    const fileWeek = fileWeeks[i];
                    // Insert lecture placeholder
                    const { data: newLecture, error: insertError } = await supabase
                      .from('lectures')
                      .insert([{ course_id: activeCourseId, file_url: '', title: file.name, week: fileWeek ? parseInt(fileWeek) : null }])
                      .select()
                      .single();

                    if (insertError) throw insertError;

                    // 1. Upload the original file to Cloudinary
                    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
                    if (!uploadPreset) throw new Error('Cloudinary upload preset is not configured.');

                    const formDataCloudinary = new FormData();
                    formDataCloudinary.append('file', file);
                    formDataCloudinary.append('upload_preset', uploadPreset);
                    // For PPTX, we might want to specify resource_type raw or auto. auto works well.
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
                    const { error: updateErr } = await supabase
                      .from('lectures')
                      .update({ file_url: fileData.secure_url, processing: true })
                      .eq('id', newLecture.id);
                    if (updateErr) throw updateErr;

                    // 2. Send file to FastAPI conversion endpoint for image generation and AI processing
                    setIsProcessing(true);
                    const formDataFastAPI = new FormData();
                    formDataFastAPI.append('file', file);
                    formDataFastAPI.append('lecture_id', newLecture.id);
                    const userRes = await supabase.auth.getUser();
                    const userId = userRes.data.user?.id || '';
                    formDataFastAPI.append('user_id', userId);

                    const apiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000';
                    const convertRes = await fetch(`${apiUrl}/convert`, {
                      method: 'POST',
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

                if (successCount > 0) {
                  toast.success(`Successfully uploaded ${successCount} lecture${successCount > 1 ? 's' : ''}!`);
                }

                // Cleanup and refresh
                setIsUploading(false);
                setIsProcessing(false);
                setUploadProgress(0);
                setCurrentUploadIndex(0);
                setSelectedFiles([]);
                setFileWeeks({});
                fetchCourses();
                if (failCount === 0) {
                  setIsUploadDialogOpen(false);
                }
              }}
            >
              {selectedFiles.length > 0 ? (isUploading ? `Uploading ${currentUploadIndex + 1}/${selectedFiles.length}...` : `Upload ${selectedFiles.length} Lecture${selectedFiles.length > 1 ? 's' : ''}`) : 'Select files'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

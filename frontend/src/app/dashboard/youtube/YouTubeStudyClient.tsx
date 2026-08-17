'use client'

import { useState } from 'react'
import { Search, PlaySquare, Play, Pin, Clock, CheckCircle2, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ShareButton } from '@/components/study/ShareButton'
import { useRouter } from 'next/navigation'

type Course = {
  id: string
  title: string
  course_code: string
}

type PinnedVideo = {
  id: string
  video_id: string
  title: string
  channel: string
  thumbnail_url: string
  watched: boolean
  course_id: string
}

type YouTubeResult = {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  description: string
}

export function YouTubeStudyClient({ 
  courses, 
  initialPinnedVideos 
}: { 
  courses: Course[], 
  initialPinnedVideos: PinnedVideo[] 
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<YouTubeResult[]>([])
  
  const [pinnedVideos, setPinnedVideos] = useState<PinnedVideo[]>(initialPinnedVideos)
  const [activeCourseId, setActiveCourseId] = useState<string>('all')

  const router = useRouter()

  const handleWatchVideo = (video: PinnedVideo | YouTubeResult) => {
    const videoId = 'videoId' in video ? video.videoId : video.video_id
    const searchParams = new URLSearchParams()
    searchParams.set('title', video.title)
    if (video.channel) searchParams.set('channel', video.channel)
    router.push(`/dashboard/youtube/watch/${videoId}?${searchParams.toString()}`)
  }
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      
      setSearchResults(data.videos)
    } catch (err: any) {
      toast.error(err.message || 'Failed to search YouTube')
    } finally {
      setIsSearching(false)
    }
  }

  const handlePin = async (video: YouTubeResult, courseId: string) => {
    try {
      const res = await fetch('/api/youtube/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.videoId,
          title: video.title,
          channel: video.channel,
          thumbnail: video.thumbnail,
          courseId
        })
      })
      
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      
      toast.success('Video pinned to course!')
      
      // Optimistically add to list (re-fetch in a real app)
      setPinnedVideos([{
        id: Math.random().toString(),
        video_id: video.videoId,
        title: video.title,
        channel: video.channel,
        thumbnail_url: video.thumbnail,
        watched: false,
        course_id: courseId
      }, ...pinnedVideos])
      
    } catch (err: any) {
      toast.error(err.message || 'Failed to pin video')
    }
  }

  const filteredPinned = activeCourseId === 'all' 
    ? pinnedVideos 
    : pinnedVideos.filter(v => v.course_id === activeCourseId)

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      
      {/* LEFT PANEL: Search */}
      <div className="w-1/3 flex flex-col border-r border-border pr-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <PlaySquare className="text-red-500" /> Discover
        </h2>
        
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search lectures, tutorials..." 
              className="pl-9 bg-background/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {searchResults.map((video) => (
            <Card key={video.videoId} className="overflow-hidden hover:border-primary/50 transition-colors">
              <div className="relative aspect-video group cursor-pointer" onClick={() => handleWatchVideo(video)}>
                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="text-white h-12 w-12" />
                </div>
              </div>
              <CardContent className="p-3">
                <h3 className="font-semibold text-sm line-clamp-2 mb-1">{video.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">{video.channel}</p>
                
                {courses.length > 0 ? (
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 text-xs bg-muted rounded px-2 py-1 border border-border"
                      onChange={(e) => handlePin(video, e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>Pin to course...</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.course_code}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-orange-500">Create a course to pin videos.</p>
                )}
              </CardContent>
            </Card>
          ))}
          {searchResults.length === 0 && !isSearching && (
             <div className="text-center py-12 text-muted-foreground">
               <PlaySquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
               <p>Search for a topic to find study videos.</p>
             </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Pinned Library */}
      <div className="flex-1 flex flex-col pl-2">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Pin className="text-primary" /> Pinned Library
          </h2>
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Badge 
              variant={activeCourseId === 'all' ? 'default' : 'secondary'} 
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setActiveCourseId('all')}
            >
              All Courses
            </Badge>
            {courses.map(c => (
              <Badge 
                key={c.id}
                variant={activeCourseId === c.id ? 'default' : 'secondary'} 
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setActiveCourseId(c.id)}
              >
                {c.course_code}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredPinned.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Pin className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No videos pinned yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPinned.map(video => {
                const course = courses.find(c => c.id === video.course_id)
                return (
                  <Card key={video.id} className="overflow-hidden group hover:border-primary/50 transition-colors cursor-pointer" onClick={() => handleWatchVideo(video)}>
                    <div className="relative aspect-video">
                      <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="text-white h-10 w-10" />
                      </div>
                      {video.watched && (
                        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <div className="text-[10px] font-bold text-primary mb-1 uppercase tracking-wider">{course?.course_code}</div>
                      <h3 className="font-semibold text-sm line-clamp-2 mb-1">{video.title}</h3>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          {video.channel}
                        </p>
                        <ShareButton 
                          contentType="video_list"
                          contentId={video.id}
                          title={video.title}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

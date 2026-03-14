import { useState, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

interface MediaPreviewProps {
  media: {
    url: string;
    type: 'IMAGE' | 'VIDEO';
    mimeType?: string;
    filename: string;
    thumbnailUrl?: string;
  };
  className?: string;
}

export function MediaPreview({ media, className = '' }: MediaPreviewProps) {
  const isVideo = media.type === 'VIDEO' || media.mimeType?.startsWith('video/');
  const isGif = media.mimeType === 'image/gif';

  if (isVideo) {
    return <VideoPreview media={media} className={className} />;
  }

  if (isGif) {
    return <GifPreview media={media} className={className} />;
  }

  return <ImagePreview media={media} className={className} />;
}

function ImagePreview({ media, className }: MediaPreviewProps) {
  const [showZoom, setShowZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [zoomLevel, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (showZoom) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    }
  }, [showZoom, handleZoomIn, handleZoomOut]);

  return (
    <>
      <div className={`relative ${className}`}>
        <img
          src={media.url}
          alt={media.filename}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => setShowZoom(true)}
        />
        <button
          onClick={() => setShowZoom(true)}
          className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom Modal */}
      {showZoom && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={media.url}
              alt={media.filename}
              className="max-w-none cursor-move"
              style={{
                transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              draggable={false}
            />

            {/* Controls */}
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={handleZoomOut}
                className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setShowZoom(false);
                  setZoomLevel(1);
                  setPosition({ x: 0, y: 0 });
                }}
                className="p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70"
              >
                ×
              </button>
            </div>

            {/* Zoom Level Indicator */}
            <div className="absolute bottom-4 left-4 px-3 py-1 bg-black bg-opacity-50 text-white rounded-full text-sm">
              {Math.round(zoomLevel * 100)}%
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function VideoPreview({ media, className }: MediaPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={`relative group ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={media.url}
        poster={media.thumbnailUrl}
        className="w-full h-full object-cover"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        muted={isMuted}
      />

      {/* Play Button Overlay */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-40 transition-all"
        >
          <Play className="w-12 h-12 text-white" />
        </button>
      )}

      {/* Controls */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="text-white hover:text-gray-300"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <div className="flex-1 flex items-center gap-2">
              <span className="text-white text-sm">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-white text-sm">{formatTime(duration)}</span>
            </div>

            <button
              onClick={toggleMute}
              className="text-white hover:text-gray-300"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GifPreview({ media, className }: MediaPreviewProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={media.url}
        alt={media.filename}
        className={`w-full h-full object-cover transition-all ${
          isHovered ? 'scale-105' : 'scale-100'
        }`}
      />
      
      {/* GIF Indicator */}
      <div className="absolute top-2 left-2 px-2 py-1 bg-black bg-opacity-70 text-white text-xs rounded">
        GIF
      </div>
    </div>
  );
}
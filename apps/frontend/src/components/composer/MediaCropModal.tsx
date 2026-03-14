import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { X, RotateCcw, Check, Crop } from 'lucide-react';
import { SocialPlatform } from '@/types/composer.types';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AspectRatio {
  label: string;
  ratio: number;
  width: number;
  height: number;
}

interface MediaCropModalProps {
  isOpen: boolean;
  imageUrl: string;
  selectedPlatforms: SocialPlatform[];
  onCrop: (croppedImages: Record<SocialPlatform, string>) => void;
  onClose: () => void;
}

const PLATFORM_ASPECT_RATIOS: Record<SocialPlatform, AspectRatio[]> = {
  instagram: [
    { label: 'Square (1:1)', ratio: 1, width: 1080, height: 1080 },
    { label: 'Portrait (4:5)', ratio: 0.8, width: 1080, height: 1350 },
    { label: 'Landscape (1.91:1)', ratio: 1.91, width: 1080, height: 566 },
    { label: 'Story/Reel (9:16)', ratio: 0.5625, width: 1080, height: 1920 },
  ],
  twitter: [
    { label: 'Landscape (16:9)', ratio: 16/9, width: 1200, height: 675 },
    { label: 'Square (1:1)', ratio: 1, width: 1200, height: 1200 },
  ],
  linkedin: [
    { label: 'Landscape (1.91:1)', ratio: 1.91, width: 1200, height: 628 },
    { label: 'Square (1:1)', ratio: 1, width: 1200, height: 1200 },
  ],
  facebook: [
    { label: 'Landscape (1.91:1)', ratio: 1.91, width: 1200, height: 628 },
    { label: 'Square (1:1)', ratio: 1, width: 1200, height: 1200 },
  ],
  pinterest: [
    { label: 'Portrait (2:3)', ratio: 2/3, width: 1000, height: 1500 },
    { label: 'Square (1:1)', ratio: 1, width: 1000, height: 1000 },
  ],
  youtube: [
    { label: 'Thumbnail (16:9)', ratio: 16/9, width: 1280, height: 720 },
  ],
  threads: [
    { label: 'Square (1:1)', ratio: 1, width: 1080, height: 1080 },
    { label: 'Portrait (4:5)', ratio: 0.8, width: 1080, height: 1350 },
  ],
  bluesky: [
    { label: 'Landscape (16:9)', ratio: 16/9, width: 1200, height: 675 },
    { label: 'Square (1:1)', ratio: 1, width: 1200, height: 1200 },
  ],
  'google-business': [
    { label: 'Landscape (16:9)', ratio: 16/9, width: 1200, height: 675 },
    { label: 'Square (1:1)', ratio: 1, width: 1200, height: 1200 },
  ],
};

const MediaCropModal = memo(function MediaCropModal({
  isOpen,
  imageUrl,
  selectedPlatforms,
  onCrop,
  onClose,
}: MediaCropModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio | null>(null);
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [croppedImages, setCroppedImages] = useState<Record<SocialPlatform, string>>(() => ({} as Record<SocialPlatform, string>));
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<HTMLDivElement>(null);

  // Initialize with first platform
  useEffect(() => {
    if (selectedPlatforms.length > 0 && !selectedPlatform) {
      setSelectedPlatform(selectedPlatforms[0]);
    }
  }, [selectedPlatforms, selectedPlatform]);

  // Set default aspect ratio when platform changes
  useEffect(() => {
    if (selectedPlatform) {
      const ratios = PLATFORM_ASPECT_RATIOS[selectedPlatform];
      if (ratios && ratios.length > 0) {
        setSelectedRatio(ratios[0]);
      }
    }
  }, [selectedPlatform]);

  // Update crop area when aspect ratio changes
  useEffect(() => {
    if (selectedRatio && imageRef.current) {
      const img = imageRef.current;
      const containerRect = img.getBoundingClientRect();
      
      // Calculate crop area to fit the aspect ratio
      let width, height;
      if (selectedRatio.ratio >= 1) {
        // Landscape or square
        width = Math.min(containerRect.width * 0.8, containerRect.height * 0.8 * selectedRatio.ratio);
        height = width / selectedRatio.ratio;
      } else {
        // Portrait
        height = Math.min(containerRect.height * 0.8, containerRect.width * 0.8 / selectedRatio.ratio);
        width = height * selectedRatio.ratio;
      }
      
      setCropArea({
        x: (containerRect.width - width) / 2,
        y: (containerRect.height - height) / 2,
        width,
        height,
      });
    }
  }, [selectedRatio]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - cropArea.x, y: e.clientY - cropArea.y });
  }, [cropArea]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(e.clientX - dragStart.x, rect.width - cropArea.width));
    const newY = Math.max(0, Math.min(e.clientY - dragStart.y, rect.height - cropArea.height));
    
    setCropArea(prev => ({ ...prev, x: newX, y: newY }));
  }, [isDragging, dragStart, cropArea.width, cropArea.height]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const cropImage = useCallback(async (platform: SocialPlatform, ratio: AspectRatio) => {
    if (!imageRef.current || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    
    // Calculate scale factors
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    
    // Set canvas size to target dimensions
    canvas.width = ratio.width;
    canvas.height = ratio.height;
    
    // Calculate source crop area in original image coordinates
    const sourceX = cropArea.x * scaleX;
    const sourceY = cropArea.y * scaleY;
    const sourceWidth = cropArea.width * scaleX;
    const sourceHeight = cropArea.height * scaleY;
    
    // Draw cropped image
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, ratio.width, ratio.height
    );
    
    return canvas.toDataURL('image/jpeg', 0.9);
  }, [cropArea]);

  const handleApplyCrop = useCallback(async () => {
    if (!selectedPlatform || !selectedRatio) return;
    
    setIsProcessing(true);
    
    try {
      const croppedImage = await cropImage(selectedPlatform, selectedRatio);
      if (croppedImage) {
        setCroppedImages(prev => ({
          ...prev,
          [selectedPlatform]: croppedImage,
        }));
      }
    } catch (error) {
      console.error('Failed to crop image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPlatform, selectedRatio, cropImage]);

  const handleFinish = useCallback(() => {
    onCrop(croppedImages);
    onClose();
  }, [croppedImages, onCrop, onClose]);

  const handleReset = useCallback(() => {
    setCroppedImages({} as Record<SocialPlatform, string>);
    if (selectedPlatform) {
      const ratios = PLATFORM_ASPECT_RATIOS[selectedPlatform];
      if (ratios && ratios.length > 0) {
        setSelectedRatio(ratios[0]);
      }
    }
  }, [selectedPlatform]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Crop className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold">Crop Image for Platforms</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[70vh]">
          {/* Sidebar */}
          <div className="w-80 border-r bg-gray-50 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* Platform Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform
                </label>
                <select
                  value={selectedPlatform || ''}
                  onChange={(e) => setSelectedPlatform(e.target.value as SocialPlatform)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {selectedPlatforms.map(platform => (
                    <option key={platform} value={platform}>
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Aspect Ratio Selection */}
              {selectedPlatform && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aspect Ratio
                  </label>
                  <div className="space-y-2">
                    {PLATFORM_ASPECT_RATIOS[selectedPlatform]?.map((ratio) => (
                      <button
                        key={ratio.label}
                        onClick={() => setSelectedRatio(ratio)}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                          selectedRatio?.label === ratio.label
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium">{ratio.label}</div>
                        <div className="text-sm text-gray-500">
                          {ratio.width} × {ratio.height}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={handleApplyCrop}
                  disabled={!selectedPlatform || !selectedRatio || isProcessing}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Apply Crop
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleReset}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset All
                </button>
              </div>

              {/* Cropped Images Status */}
              {Object.keys(croppedImages).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cropped Platforms
                  </label>
                  <div className="space-y-1">
                    {Object.keys(croppedImages).map(platform => (
                      <div key={platform} className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="h-3 w-3" />
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Crop Area */}
          <div className="flex-1 p-4 flex items-center justify-center bg-gray-100">
            <div className="relative max-w-full max-h-full">
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Crop preview"
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
              
              {/* Crop Overlay */}
              {selectedRatio && (
                <div
                  ref={cropperRef}
                  className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 cursor-move"
                  style={{
                    left: cropArea.x,
                    top: cropArea.y,
                    width: cropArea.width,
                    height: cropArea.height,
                  }}
                  onMouseDown={handleMouseDown}
                >
                  {/* Corner handles */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-white rounded-full" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-full" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border border-white rounded-full" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-full" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            Drag the crop area to adjust. Apply crop for each platform you want to customize.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleFinish}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Finish Cropping
            </button>
          </div>
        </div>

        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
});

export { MediaCropModal };
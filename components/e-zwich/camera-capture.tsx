"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, X, RotateCcw, Check, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  label: string;
  currentImage?: File | string | null;
}

export function CameraCapture({
  onCapture,
  label,
  currentImage,
}: CameraCaptureProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setStream(mediaStream);
      setShowCamera(true);

      // Wait for video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Error",
        description:
          "Could not access camera. Please check permissions or use file upload.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL("image/jpeg", 0.9);
        setCapturedImage(imageData);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      // Convert data URL to File
      fetch(capturedImage)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `${label.replace(/\s/g, "_")}_${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          onCapture(file);
          toast({
            title: "Photo Captured",
            description: `${label} has been captured successfully`,
          });
          handleClose();
        })
        .catch((error) => {
          console.error("Error converting image:", error);
          toast({
            title: "Capture Failed",
            description: "Failed to process captured image",
            variant: "destructive",
          });
        });
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setShowCamera(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file);
      toast({
        title: "File Uploaded",
        description: `${label} has been uploaded successfully`,
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const getPreviewUrl = () => {
    if (currentImage instanceof File) {
      return URL.createObjectURL(currentImage);
    }
    return currentImage;
  };

  return (
    <>
      <div className="space-y-2">
        <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center hover:border-primary transition bg-muted/30">
          {currentImage ? (
            <img
              src={getPreviewUrl() || ""}
              alt={label}
              className="w-24 h-24 object-cover rounded mb-2 border"
            />
          ) : (
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          )}
          
          <div className="flex gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startCamera}
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              Camera
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          
          <span className="text-xs text-muted-foreground mt-2">
            {currentImage ? "Image selected" : label}
          </span>
        </div>
      </div>

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Capture {label}</DialogTitle>
            <DialogDescription>
              Position the camera and click capture when ready
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!capturedImage ? (
              <>
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex justify-center gap-2">
                  <Button onClick={capturePhoto} className="gap-2">
                    <Camera className="h-4 w-4" />
                    Capture Photo
                  </Button>
                  <Button onClick={handleClose} variant="outline" className="gap-2">
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex justify-center gap-2">
                  <Button onClick={confirmPhoto} className="gap-2">
                    <Check className="h-4 w-4" />
                    Use This Photo
                  </Button>
                  <Button onClick={retakePhoto} variant="outline" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Retake
                  </Button>
                  <Button onClick={handleClose} variant="outline" className="gap-2">
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Hidden canvas for capturing */}
          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    </>
  );
}

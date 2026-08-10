import { useEffect, useRef } from 'react';
import { SkinViewer, IdleAnimation, WalkingAnimation, RunningAnimation } from 'skinview3d';

interface SkinViewer3DProps {
  skinUrl?: string;
  capeUrl?: string;
  className?: string; // Replace hardcoded width/height with Tailwind classes
  animation?: 'idle' | 'walk' | 'run' | 'none';
  paused?: boolean;
}

export function SkinViewer3D({ 
  skinUrl = "https://mineskin.eu/skin/Steve",
  capeUrl,
  className = "w-full h-full",
  animation = 'none',
  paused = false
}: SkinViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Initialize with a default size, ResizeObserver will fix it immediately
    const options: any = {
      canvas: canvasRef.current,
      width: 300,
      height: 400,
      skin: skinUrl,
      alpha: true,
      ...(capeUrl ? { cape: capeUrl } : {})
    };
    const viewer = new SkinViewer(options);

    viewer.fov = 70;
    viewer.zoom = 0.9;
    
    viewer.autoRotate = false;
    viewer.renderer.setClearColor(0x000000, 0);

    viewer.controls.enableZoom = false;
    viewer.controls.minPolarAngle = Math.PI / 2;
    viewer.controls.maxPolarAngle = Math.PI / 2;

    if (animation === 'idle') {
      viewer.animation = new IdleAnimation();
    } else if (animation === 'walk') {
      viewer.animation = new WalkingAnimation();
    } else if (animation === 'run') {
      viewer.animation = new RunningAnimation();
    }

    viewerRef.current = viewer;

    // ResizeObserver to automatically resize the canvas to match the container
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef.current && viewerRef.current) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            viewerRef.current.setSize(width, height);
          }
        }
      }
    });
    
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      viewer.dispose();
    };
  }, [skinUrl, capeUrl, animation]);

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.renderPaused = paused;
    }
  }, [paused]);

  return (
    <div ref={containerRef} className={`relative group rounded-2xl overflow-hidden ${className}`}>
      <canvas 
        ref={canvasRef} 
        className="w-full h-full cursor-grab"
      />
    </div>
  );
}

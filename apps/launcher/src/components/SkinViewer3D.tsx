import { useEffect, useRef } from 'react';
import { SkinViewer, IdleAnimation, WalkingAnimation, RunningAnimation } from 'skinview3d';

interface SkinViewer3DProps {
  skinUrl?: string;
  capeUrl?: string;
  className?: string; // Replace hardcoded width/height with Tailwind classes
  animation?: 'idle' | 'walk' | 'run' | 'none';
  paused?: boolean;
}

/**
 * Apercu 3D du personnage.
 *
 * <p>Le viewer est construit une seule fois, au montage, et jamais reconstruit
 * ensuite: changer de peau ou de cape recharge la texture dans le viewer
 * existant. C'est la difference entre changer un vetement et refaire le
 * mannequin. Auparavant, `capeUrl` figurait parmi les dependances de l'effet de
 * construction, si bien qu'essayer une cape dans le vestiaire detruisait le
 * contexte WebGL, en creait un neuf et retelechargeait la peau -- a chaque clic.
 * Les navigateurs limitent par ailleurs le nombre de contextes WebGL vivants, et
 * en detruire un a chaque essayage flirte avec cette limite pour rien.
 */
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

  // Les chargements de texture s'enchainent au lieu de partir en parallele.
  //
  // Sans cela, deux essayages rapproches peuvent revenir dans le desordre: la
  // reponse de la premiere cape arrive apres celle de la seconde et l'ecrase,
  // laissant a l'ecran une cape que le joueur ne porte plus. Serialiser garantit
  // que la derniere demandee est la derniere appliquee.
  const skinQueue = useRef<Promise<unknown>>(Promise.resolve());
  const capeQueue = useRef<Promise<unknown>>(Promise.resolve());

  // Une texture peut finir de charger apres la fermeture du vestiaire: on ne
  // touche plus a un viewer detruit.
  const disposed = useRef(false);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Initialize with a default size, ResizeObserver will fix it immediately
    const options: any = {
      canvas: canvasRef.current,
      width: 300,
      height: 400,
      alpha: true
    };
    const viewer = new SkinViewer(options);

    viewer.fov = 70;
    viewer.zoom = 0.9;

    viewer.autoRotate = false;
    viewer.renderer.setClearColor(0x000000, 0);

    viewer.controls.enableZoom = false;
    viewer.controls.minPolarAngle = Math.PI / 2;
    viewer.controls.maxPolarAngle = Math.PI / 2;

    disposed.current = false;
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
      disposed.current = true;
      viewerRef.current = null;
      resizeObserver.disconnect();
      viewer.dispose();
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    skinQueue.current = skinQueue.current
      // Un echec precedent ne doit pas bloquer la file: on repart proprement.
      .catch(() => {})
      .then(() => {
        if (disposed.current) return;
        // Une adresse morte laisse le personnage en Steve plutot qu'invisible.
        return viewer.loadSkin(skinUrl).catch(() => {
          if (!disposed.current) viewer.resetSkin();
        });
      });
  }, [skinUrl]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    capeQueue.current = capeQueue.current
      .catch(() => {})
      .then(() => {
        if (disposed.current) return;
        if (!capeUrl) {
          viewer.resetCape();
          return;
        }
        return viewer.loadCape(capeUrl).catch(() => {
          if (!disposed.current) viewer.resetCape();
        });
      });
  }, [capeUrl]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (animation === 'idle') {
      viewer.animation = new IdleAnimation();
    } else if (animation === 'walk') {
      viewer.animation = new WalkingAnimation();
    } else if (animation === 'run') {
      viewer.animation = new RunningAnimation();
    } else {
      viewer.animation = null;
    }
  }, [animation]);

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

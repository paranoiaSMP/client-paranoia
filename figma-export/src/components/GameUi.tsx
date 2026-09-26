import { motion, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

const DESIGN_WIDTH = 860;
const DESIGN_HEIGHT = 520;

const SETTINGS_HEIGHTS = [
  57, 57, 65, 77, 82, 95, 111, 144, 192, 245, 326, 352, 387, 401, 424,
  448, 474, 504, 504,
];

const SETTINGS_TIMES = [
  0, 0.0075, 0.0385, 0.0636, 0.0861, 0.1098, 0.137, 0.1662, 0.2006,
  0.2314, 0.2638, 0.2926, 0.3226, 0.3432, 0.3691, 0.3961, 0.4267,
  0.459, 1,
];

const CARD_POSITIONS = [34, 209, 384];

export interface GameUiProps {
  className?: string;
  instances?: string[];
  onAdd?: () => void;
  onPlay?: () => void;
  onSettings?: () => void;
}

interface InstanceCardProps {
  label: string;
  left: number;
  nodeId: string;
}

function useCanvasScale() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const shell = shellRef.current;

    if (!shell) {
      return undefined;
    }

    const updateScale = () => {
      setScale(Math.min(1, shell.getBoundingClientRect().width / DESIGN_WIDTH));
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(shell);

    return () => observer.disconnect();
  }, []);

  return { scale, shellRef };
}

function InstanceCard({ label, left, nodeId }: InstanceCardProps) {
  return (
    <article
      className="absolute top-[226px] flex h-[143px] w-[146px] items-end overflow-hidden rounded-[14px] border border-[#333] bg-[#212121] p-3"
      data-node-id={nodeId}
      style={{ left }}
    >
      <p className="whitespace-nowrap text-[11px] font-medium leading-normal text-white">
        {label}
      </p>
    </article>
  );
}

export function GameUi({
  className,
  instances = ["Nouvelle instance", "Nouvelle instance", "Nouvelle instance"],
  onAdd,
  onPlay,
  onSettings,
}: GameUiProps) {
  const prefersReducedMotion = useReducedMotion();
  const { scale, shellRef } = useCanvasScale();
  const cardLabels = CARD_POSITIONS.map(
    (_, index) => instances[index] ?? "Nouvelle instance",
  );

  return (
    <div
      ref={shellRef}
      className="w-full min-w-0 max-w-[860px]"
      style={{ height: DESIGN_HEIGHT * scale }}
    >
      <section
        aria-label="Interface principale du jeu"
        className={[
          "game-ui-canvas relative h-[520px] w-[860px] overflow-hidden rounded-[24px] bg-[#141414] ring-1 ring-inset ring-[#333]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        data-name="Game UI"
        data-node-id="3:2"
        style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        <div
          className="absolute left-[26px] top-[38px] h-[99px] w-[600px] overflow-hidden rounded-[20px] bg-[#262626]"
          data-name="Slide 1"
          data-node-id="3:14"
        />

        <img
          alt=""
          aria-hidden="true"
          className="absolute left-[55px] top-[165px] h-2 w-[104px]"
          data-name="Slide Indicators"
          data-node-id="3:16"
          height="8"
          src="/assets/slide-indicators.svg"
          width="104"
        />

        {cardLabels.map((label, index) => (
          <InstanceCard
            key={CARD_POSITIONS[index]}
            label={label}
            left={CARD_POSITIONS[index]}
            nodeId={["3:53", "15:72", "15:86"][index]}
          />
        ))}

        <button
          aria-label="Ajouter une instance"
          className="absolute left-[559px] top-[282px] grid size-8 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9309ef]"
          data-name="Plus square"
          data-node-id="15:169"
          onClick={onAdd}
          type="button"
        >
          <img
            alt=""
            aria-hidden="true"
            className="size-[27px]"
            height="27"
            src="/assets/plus-square.svg"
            width="27"
          />
        </button>

        <motion.div
          aria-hidden="true"
          animate={
            prefersReducedMotion ? undefined : { height: SETTINGS_HEIGHTS }
          }
          className="absolute left-[790px] top-[32px] z-10 w-14 overflow-hidden rounded-[14px] border border-[#333] bg-[#212121]"
          data-node-id="2:63"
          initial={{ height: 57 }}
          transition={{
            height: {
              duration: 2,
              ease: "linear",
              repeat: Infinity,
              times: SETTINGS_TIMES,
            },
          }}
        />

        <button
          aria-label="Ouvrir les paramètres"
          className="absolute left-[790px] top-[32px] z-20 h-[51px] w-14 overflow-hidden rounded-[14px] border border-[#333] bg-[#212121] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9309ef]"
          data-name="slide parametre"
          data-node-id="2:83"
          onClick={onSettings}
          type="button"
        />

        <div
          className="absolute left-[34px] top-[422px] flex h-[74px] w-[108px] items-center overflow-hidden"
          data-name="Component"
          data-node-id="2:136"
        >
          <button
            aria-label="Lancer"
            className="flex h-[61px] w-[108px] items-center justify-center overflow-hidden rounded-[10px] bg-[#61069e] text-sm font-normal text-white transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9309ef]"
            data-name="Play Button"
            data-node-id="2:420"
            onClick={onPlay}
            type="button"
          >
            <span aria-hidden="true">▶</span>
          </button>
        </div>
      </section>
    </div>
  );
}

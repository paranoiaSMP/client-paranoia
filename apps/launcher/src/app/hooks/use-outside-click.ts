import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Appelle {@code callback} quand on clique en dehors de {@code ref}.
 *
 * <p>Les deux ecouteurs sont poses sur {@code document}: souris et tactile, un
 * appareil pouvant avoir les deux.
 */
export const useOutsideClick = (
  ref: RefObject<HTMLElement | null>,
  // `Function` acceptait n'importe quoi d'appelable, y compris avec la
  // mauvaise signature, et ne disait rien de ce qui est passe au rappel.
  callback: (event: MouseEvent | TouchEvent) => void,
) => {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // `event.target` est un EventTarget, que `contains` n'accepte pas: le
      // cas reel est toujours un Node, mais il faut le dire.
      const cible = event.target;
      if (
        !ref.current ||
        !(cible instanceof Node) ||
        ref.current.contains(cible)
      ) {
        return;
      }
      callback(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, callback]);
};

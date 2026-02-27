/**
 * Bloqueia o menu de contexto ao clicar com botão direito em filtros (data-bubble-type="filter").
 */

import { useEffect } from "react";

export function useFilterContextMenuBlock(): void {
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.('[data-bubble-type="filter"]')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("contextmenu", handler, true);
    return () => document.removeEventListener("contextmenu", handler, true);
  }, []);
}

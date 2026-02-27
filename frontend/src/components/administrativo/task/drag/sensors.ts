/**
 * Sensores de pointer para o DnD do TaskBoard.
 * distance: 5px para ativação rápida (cliques sem movimento ainda funcionam).
 */

import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

export function useTaskBoardSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
}

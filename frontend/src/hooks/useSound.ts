import { useCallback } from "react";

export const REMINDER_SOUNDS = [
  "chimes1",
  "chimes2",
  "chimes3",
  "chimes4",
  "modern1",
  "modern2",
  "modern3",
] as const;
export type ReminderSoundId = (typeof REMINDER_SOUNDS)[number];

export function isValidReminderSound(id: string | null | undefined): id is ReminderSoundId {
  return !!id && REMINDER_SOUNDS.includes(id as ReminderSoundId);
}

const DEFAULT_SOUND: ReminderSoundId = "chimes1";

/**
 * Carrega e reproduz sons dinamicamente via /sounds/${soundName}.mp3.
 * Aceita qualquer um dos 7 sons: chimes1-4, modern1-3.
 */
export function useSound() {
  const play = useCallback((soundName?: string | null) => {
    const id = isValidReminderSound(soundName) ? soundName : DEFAULT_SOUND;
    const src = `/sounds/${id}.mp3`;
    const audio = new Audio(src);
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Silently ignore — file may not exist or autoplay blocked
    });
  }, []);

  return { play };
}

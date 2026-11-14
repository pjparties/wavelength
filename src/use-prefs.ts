import { useEffect, useState } from "react";
import { setSoundEnabled } from "./audio.ts";
import { safeGet, safeSet } from "./storage.ts";

const SOUND_KEY = "wavelength.sound.v1";
const EASY_KEY = "wavelength.easy.v1";

/** Sound and difficulty. Hard mode is the default: no scale, no position readouts. */
export function usePrefs() {
  const [soundOn, setSoundOn] = useState(() => safeGet(SOUND_KEY) !== "off");
  const [easyMode, setEasyMode] = useState(() => safeGet(EASY_KEY) === "on");

  useEffect(() => {
    setSoundEnabled(soundOn);
    safeSet(SOUND_KEY, soundOn ? "on" : "off");
  }, [soundOn]);

  useEffect(() => {
    safeSet(EASY_KEY, easyMode ? "on" : "off");
  }, [easyMode]);

  return { soundOn, setSoundOn, easyMode, setEasyMode };
}

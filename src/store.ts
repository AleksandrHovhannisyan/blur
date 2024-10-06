function makeBlurIntensityStore() {
  const BLUR_INTENSITY_STORAGE_KEY = "blur-intensity";
  const DEFAULT_BLUR_INTENSITY = 0.5;

  return {
    /** Returns the current value from the extension storage, or the default intensity if no value was previously saved. */
    async get() {
      const storage = await chrome.storage.local.get();
      return Number(
        storage[BLUR_INTENSITY_STORAGE_KEY] ?? DEFAULT_BLUR_INTENSITY
      );
    },
    /** Sets the current value in the extension storage to the provided value. */
    async set(blurIntensity: number) {
      await chrome.storage.local.set({
        [BLUR_INTENSITY_STORAGE_KEY]: blurIntensity,
      });
    },
  };
}
export const blurIntensityStore = makeBlurIntensityStore();
import { BLUR_INTENSITY_CUSTOM_PROPERTY } from "./constants.js";
import { blurIntensityStore } from "./store.js";

const blurIntensityInput: HTMLInputElement =
  document.querySelector("#blur-intensity")!;

// FIXME: use chrome.storage.sync if possible to sync across user account. In FireFox, this doesn't work unless your manifest has an explicit ID.
// https://stackoverflow.com/a/74781189/5323344

// Initialize range value from previously saved value
blurIntensityStore.get().then((intensity) => {
  blurIntensityInput.value = intensity.toString();
});

blurIntensityInput?.addEventListener("input", async () => {
  const blurIntensity = blurIntensityInput.valueAsNumber;
  await blurIntensityStore.set(blurIntensity);

  // Get current tab and set a custom property on the document root so all blurred elements use the new value
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [BLUR_INTENSITY_CUSTOM_PROPERTY, blurIntensity],
    func: (BLUR_INTENSITY_CUSTOM_PROPERTY, blurIntensity) => {
      document.documentElement.style.setProperty(
        `--${BLUR_INTENSITY_CUSTOM_PROPERTY}`,
        blurIntensity.toString()
      );
    },
  });
});

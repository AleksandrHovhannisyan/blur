const BLUR_INTENSITY_STORAGE_KEY = "text-blur-intensity";

const blurIntensityInput: HTMLInputElement = document.querySelector("#blur-intensity")!;

// FIXME: use chrome.storage.sync if possible to sync across user account. In FireFox, this doesn't work unless your manifest has an explicit ID.
// https://stackoverflow.com/a/74781189/5323344

// Init range value from previously saved value (if one exists)
chrome.storage.local.get().then((items) => {
  // Extra precautions
  if (BLUR_INTENSITY_STORAGE_KEY in items && typeof items[BLUR_INTENSITY_STORAGE_KEY] !== 'undefined') {
    blurIntensityInput.value = items[BLUR_INTENSITY_STORAGE_KEY];
  }
});

blurIntensityInput?.addEventListener("input", async () => {
  const blurIntensity = blurIntensityInput.valueAsNumber;
  // Save the value in storage so we can re-initialize the next time the popup is opened
  await chrome.storage.local.set({ [BLUR_INTENSITY_STORAGE_KEY]: blurIntensity });
  // Get current tab and set a custom property on the document root so all blurred elements use the new value
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    args: [blurIntensity],
    func: (intensity) => {
      document.documentElement.style.setProperty(
        "--__text-blur-intensity",
        `${intensity}em`
      );
    },
  });
});

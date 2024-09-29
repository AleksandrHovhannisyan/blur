const BLUR_MENU_ITEM_ID = "blur-text";

chrome.contextMenus.create({
  id: BLUR_MENU_ITEM_ID,
  title: "Blur",
  contexts: ["selection"],
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (typeof tab?.id !== "undefined" && info.menuItemId === BLUR_MENU_ITEM_ID) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function blurSelection() {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        const span = document.createElement("span");
        span.style.filter = "blur(5px)";
        selection.getRangeAt(0).surroundContents(span);
      },
    });
  }
});

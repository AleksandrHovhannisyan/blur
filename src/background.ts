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
      func: () => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        /** Recursively blurs all of the text descendants of the given node and its children. */
        const blurTextNodes = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            if (!range.intersectsNode(node)) return;

            const text = node.nodeValue;
            // Ignore empty text nodes or text nodes that are pure/extraneous whitespace
            if (!text?.trim()) return;

            // Get the offsets relative to this text node
            let start: number = node === range.startContainer ? range.startOffset : 0;
            let end: number = node === range.endContainer ? range.endOffset : text.length;

            // Slice up original text
            const beforeText = text.slice(0, start);
            const selectedText = text.slice(start, end);
            const afterText = text.slice(end);

            // Insert text fragment before the span
            if (beforeText) {
              const beforeNode = document.createTextNode(beforeText);
              node.parentNode?.insertBefore(beforeNode, node);
            }

            // Insert span for selected portion
            const span = document.createElement("span");
            span.style.filter = "blur(0.4em)";
            span.textContent = selectedText;
            node.parentNode?.insertBefore(span, node);

            // Insert text fragment after the span
            if (afterText) {
              const afterNode = document.createTextNode(afterText);
              node.parentNode?.insertBefore(afterNode, node);
            }
            // Delete original node
            node.parentNode?.removeChild(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Recursively handle child nodes
            const childNodes = Array.from(node.childNodes);
            childNodes.forEach((child) => blurTextNodes(child));
          }
        }

        // Start wrapping text nodes from the common ancestor of the range
        blurTextNodes(range.commonAncestorContainer);

        // Clear the selection
        selection.removeAllRanges();
      },
    });
  }
});

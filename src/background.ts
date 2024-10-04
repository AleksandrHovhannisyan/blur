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
      // NOTE: all variables used in this handler must be within its scope. The browser extension runtime invokes this as a standalone function stripped of all its enclosing scopes.
      func: () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const wrapperTemplate = document.createElement("span");
        wrapperTemplate.style.filter =
          "blur(var(--__text-blur-intensity, 0.5em))";

        const TEXT_PARENTS_TO_IGNORE = new Set([
          "script",
          "style",
          "iframe",
          "noscript",
        ]);

        const isValidParent = (element: Element) =>
          !TEXT_PARENTS_TO_IGNORE.has(element.tagName.toLowerCase());

        const getTextNodesInRange = (range: Range) => {
          const textNodes: Text[] = [];

          const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode(node) {
                const parentElement = node.parentElement;
                if (parentElement && !isValidParent(parentElement)) {
                  return NodeFilter.FILTER_REJECT;
                }
                return range.intersectsNode(node)
                  ? NodeFilter.FILTER_ACCEPT
                  : NodeFilter.FILTER_REJECT;
              },
            }
          );
          // commonAncestorContainer would be a text node only if the highlight is just pure text. Otherwise, if it spans element boundaries, get nextNode.
          let currentNode =
            walker.currentNode.nodeType === Node.TEXT_NODE
              ? walker.currentNode
              : walker.nextNode();
          while (currentNode) {
            textNodes.push(currentNode as Text);
            currentNode = walker.nextNode();
          }
          return textNodes;
        };

        /** Wraps the given node's contents in the range `[startOffset, endOffset)`. */
        const wrapNode = (params: {
          /** The node whose text contents we want to wrap. */
          node: Node;
          /** The character offset to start from (inclusive). */
          startOffset?: number;
          /** The character to end at (exclusive). */
          endOffset?: number;
          /** The element with which to wrap `node`'s contents. */
          wrapperElement?: HTMLElement;
        }) => {
          const {
            node,
            startOffset,
            endOffset,
            wrapperElement = wrapperTemplate,
          } = params;
          // Ignore pure-whitespace nodes. Do this here rather than in tree walker so that the range start/end offsets line up with the actual first/last text nodes in the range.
          if (!node.textContent?.trim() || node.nodeType !== Node.TEXT_NODE) {
            return;
          }
          const wrapper = wrapperElement.cloneNode();
          const range = document.createRange();
          range.selectNodeContents(node);
          if (typeof startOffset !== "undefined") {
            range.setStart(node, startOffset);
          }
          if (typeof endOffset !== "undefined") {
            range.setEnd(node, endOffset);
          }
          range.surroundContents(wrapper);
        };

        // A selection can have multiple ranges (e.g., if you do Ctrl+A to select all text on a page).
        for (let i = 0; i < selection.rangeCount; i++) {
          const range = selection.getRangeAt(i);
          const selectedTextNodes = getTextNodesInRange(range);

          selectedTextNodes.forEach((node) => {
            if (!node.textContent) return;
            let startOffset =
              node === range.startContainer ? range.startOffset : undefined;
            let endOffset =
              node === range.endContainer ? range.endOffset : undefined;
            wrapNode({ node, startOffset, endOffset });
          });
        }

        // Remove selection
        selection.removeAllRanges();
      },
    });
  }
});

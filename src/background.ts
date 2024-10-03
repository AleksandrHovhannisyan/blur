const BLUR_MENU_ITEM_ID = "blur-text";

chrome.contextMenus.create({
  id: BLUR_MENU_ITEM_ID,
  title: "Blur",
  contexts: ["selection"],
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log(BLUR_MENU_ITEM_ID);

  if (typeof tab?.id !== "undefined" && info.menuItemId === BLUR_MENU_ITEM_ID) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      // NOTE: all variables used in this handler must be within its scope. The browser extension runtime invokes this as a standalone function stripped of all its enclosing scopes.
      func: () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const wrapperTemplate = document.createElement("span");
        wrapperTemplate.style.filter = "blur(var(--text-blur-radius, 0.4em))";

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
                if (!node.textContent) {
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
        const wrapNodeText = (params: {
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
          console.log(range, selectedTextNodes);

          selectedTextNodes.forEach((node, nodeIndex) => {
            if (!node.textContent) return;

            // Only one text node was selected, so start and end node are the same (e.g., if you highlight just a single text node or a single paragraph/h1/etc.)
            if (selectedTextNodes.length === 1) {
              // Single element node. Wrap each child in the range [start, end).
              if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                Array.from(range.startContainer.childNodes)
                  .slice(
                    range.startOffset,
                    range.startContainer === range.endContainer
                      ? range.endOffset
                      : undefined
                  )
                  .forEach((child) => wrapNodeText({ node: child }));
              } else {
                // Single text node, e.g., t[ex]t => "t" (unwrapped) "ex" (wrapped) "t" (unwrapped).
                wrapNodeText({
                  node,
                  startOffset: range.startOffset,
                  endOffset: range.endOffset,
                });
              }
            } else {
              // First of n > 1 text nodes
              if (nodeIndex === 0) {
                // Range starts at an element, so wrap its children
                if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                  Array.from(range.startContainer.childNodes)
                    .slice(range.startOffset)
                    .forEach((child) => wrapNodeText({ node: child }));
                } else {
                  // Range starts at a text node e.g., te[xt] => "te" (unwrapped) and "xt" (wrapped)
                  wrapNodeText({ node, startOffset: range.startOffset });
                }
              }
              // Last of n > 1 text nodes
              else if (nodeIndex === selectedTextNodes.length - 1) {
                // End container is an element, so pick the first `endOffset` children and select them fully.
                if (range.endContainer.nodeType === Node.ELEMENT_NODE) {
                  // wrapNodeText({ node });
                  Array.from(range.endContainer.childNodes)
                    .slice(0, range.endOffset)
                    .forEach((child) => wrapNodeText({ node: child }));
                }
                // End container is a text node, so endOffset represents a character offset within a string
                else if (range.endContainer.nodeType === Node.TEXT_NODE) {
                  // e.g., [te]xt => "te" (wrapped) and "xt" (unwrapped)
                  wrapNodeText({ node, endOffset: range.endOffset });
                }
              } else {
                // In-between text nodes (for n > 1) are easy: blur all of them
                if (node.nodeType === Node.ELEMENT_NODE) {
                  node.childNodes.forEach((child) =>
                    wrapNodeText({ node: child })
                  );
                } else {
                  wrapNodeText({ node });
                }
              }
            }
          });
        }

        // Remove selection
        selection.removeAllRanges();
      },
    });
  }
});

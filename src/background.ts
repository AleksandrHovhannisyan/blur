import { BLUR_INTENSITY_CUSTOM_PROPERTY } from "./constants.js";
import { blurIntensityStore } from "./store.js";

const BLUR_MENU_ITEM_ID = "blur-text";

chrome.contextMenus.create({
  id: BLUR_MENU_ITEM_ID,
  title: "Blur",
  contexts: ["selection"],
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (typeof tab?.id !== "undefined" && info.menuItemId === BLUR_MENU_ITEM_ID) {
    const defaultBlurIntensity = await blurIntensityStore.get();

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [defaultBlurIntensity, BLUR_INTENSITY_CUSTOM_PROPERTY],
      func: (defaultBlurIntensity, BLUR_INTENSITY_CUSTOM_PROPERTY) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        // NOTE: Normally, you can't select these elements, but ctrl+a selection will actually include them (wtf?) and the tree walker will crawl them.
        const DISALLOWED_TEXT_PARENTS = new Set([
          "script",
          "style",
          "iframe",
          "noscript",
        ]);

        const ALLOWED_MEDIA_TAGS = new Set(['img', 'video', 'iframe']);

        /** Blurs the given element by applying an inline CSS filter. */
        const blurElement = (element: HTMLElement) => {
          let unitMultiplier: `${number}em` | `${number}px`;
          if (ALLOWED_MEDIA_TAGS.has(element.tagName.toLowerCase())) {
            const { clientWidth, clientHeight } = element;
            unitMultiplier = `${Math.max(clientWidth, clientHeight) * 0.2}px`;
          } else {
            unitMultiplier = `0.5em`;
          }
          element.style.filter = `blur(calc(var(--${BLUR_INTENSITY_CUSTOM_PROPERTY}, ${defaultBlurIntensity}) * ${unitMultiplier}))`;
        };

        /** Returns all of the text nodes that intersect with the given range. */
        const getTextNodesInRange = (range: Range): Text[] => {
          const textNodes: Text[] = [];

          const walker = document.createTreeWalker(
            range.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            (node: Node) => {
              const parentElement = node.parentElement;
              if (
                parentElement &&
                DISALLOWED_TEXT_PARENTS.has(parentElement.tagName.toLowerCase())
              ) {
                return NodeFilter.FILTER_REJECT;
              }
              return range.intersectsNode(node)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
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
        const wrapTextNode = (
          node: Text,
          params?: {
            /** The character offset to start from (inclusive). If not specified, wraps from beginning of node. */
            startOffset?: number;
            /** The character to end at (exclusive). If not specifies, wraps until end of node. */
            endOffset?: number;
          }
        ) => {
          const {
            startOffset,
            endOffset,
          } = params ?? {};

          // Ignore pure-whitespace nodes. Do this here rather than in tree walker so that the range start/end offsets line up with the actual first/last text nodes in the range.
          if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
            return;
          }

          // Select appropriate portion of the text node
          const range = document.createRange();
          range.selectNodeContents(node);
          if (typeof startOffset !== "undefined") {
            range.setStart(node, startOffset);
          }
          if (typeof endOffset !== "undefined") {
            range.setEnd(node, endOffset);
          }

          // Finally, wrap it with the blur span
          const wrapper = document.createElement("span");
          blurElement(wrapper);
          range.surroundContents(wrapper);
        };

        // A selection can have multiple ranges (e.g., if you do Ctrl+A to select all text on a page).
        for (let i = 0; i < selection.rangeCount; i++) {
          const range = selection.getRangeAt(i);

          // For text nodes, wrap their selected portions in spans
          const selectedTextNodes = getTextNodesInRange(range);
          selectedTextNodes.forEach((node) => {
            if (!node.textContent) return;
            let startOffset =
              node === range.startContainer ? range.startOffset : undefined;
            let endOffset =
              node === range.endContainer ? range.endOffset : undefined;
            wrapTextNode(node, { startOffset, endOffset });
          });

          // For media nodes like images and videos, just blur the elements directly
          const selectedMediaElements = (
            range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
              ? (Array.from(
                  (
                    range.commonAncestorContainer as HTMLElement
                  ).querySelectorAll(Array.from(ALLOWED_MEDIA_TAGS.values()).join(', '))
                ) as HTMLElement[])
              : []
          ).filter((element) => range.intersectsNode(element));
          selectedMediaElements.forEach((element) => blurElement(element));
        }

        // Remove selection
        selection.removeAllRanges();
      },
    });
  }
});

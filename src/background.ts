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
      func: () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const TEXT_PARENTS_TO_IGNORE = new Set([
          "script",
          "style",
          "iframe",
          "noscript",
        ]);

        const isValidParent = (element: Element) =>
          !TEXT_PARENTS_TO_IGNORE.has(element.tagName.toLowerCase());

        const getSelectedTextNodes = (range: Range) => {
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
                if (!node.textContent?.trim()) {
                  return NodeFilter.FILTER_REJECT;
                }
                return range.intersectsNode(node)
                  ? NodeFilter.FILTER_ACCEPT
                  : NodeFilter.FILTER_REJECT;
              },
            }
          );
          // commonAncestorContainer would be a text node only if the highlight is just pure text. Otherwise, if it spans element boundaries, get nextNode.
          let currentNode: Node | null =
            walker.currentNode.nodeType === Node.TEXT_NODE
              ? walker.currentNode
              : walker.nextNode();
          while (currentNode) {
            textNodes.push(currentNode as Text);
            currentNode = walker.nextNode();
          }
          return textNodes;
        };

        const createBlurSpan = (textContent: string) => {
          const blurSpan = document.createElement("span");
          blurSpan.textContent = textContent;
          blurSpan.style.filter = "blur(var(--text-blur-radius, 0.4em))";
          return blurSpan;
        };

        const replaceWithNodes = (
          oldChild: Node,
          newChildren: Node | Node[]
        ) => {
          const { parentElement } = oldChild;
          if (!parentElement || !isValidParent(parentElement)) return;
          ([] as Node[]).concat(newChildren).forEach((newChild) => {
            parentElement.insertBefore(newChild, oldChild);
          });
          parentElement.removeChild(oldChild);
        };

        for (let i = 0; i < selection.rangeCount; i++) {
          const range = selection.getRangeAt(i);
          console.log({
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
          });
          const selectedTextNodes = getSelectedTextNodes(range);
          console.log("selectedTextNodes", selectedTextNodes);
          selectedTextNodes.forEach((textNode, textNodeIndex) => {
            if (!textNode.textContent) return;

            // Start and end node are the same (e.g., if you highlight just a single text node or a paragraph)
            if (selectedTextNodes.length === 1) {
              // Single element node. Select all the children that fall within the start and end offsets.
              if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                Array.from(range.startContainer.childNodes)
                  .slice(range.startOffset, range.endOffset)
                  .forEach((child) => {
                    if (!child.textContent) return;
                    replaceWithNodes(child, createBlurSpan(child.textContent));
                  });
              } else {
                // Single text node, e.g., split t[ex]t into: "t" (before) "ex" (selected) "t" (after).
                const beforeNode = document.createTextNode(
                  textNode.textContent.slice(0, range.startOffset)
                );
                const selectedNode = createBlurSpan(
                  textNode.textContent.slice(range.startOffset, range.endOffset)
                );
                const afterNode = document.createTextNode(
                  textNode.textContent.slice(range.endOffset)
                );
                replaceWithNodes(textNode, [
                  beforeNode,
                  selectedNode,
                  afterNode,
                ]);
              }
            } else {
              // First of n > 1 text nodes
              if (textNodeIndex === 0) {
                // Range starts at an element, so wrap its children
                if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
                  Array.from(range.startContainer.childNodes).slice(range.startOffset).forEach((child) => {
                    if (!child.textContent || child.nodeType !== Node.TEXT_NODE) return;
                    replaceWithNodes(child, createBlurSpan(child.textContent))
                  })
                } else {
                  // Range starts at a text node e.g., split te[xt] into "te" (unwrapped) and "xt" (wrapped)
                  const beforeNode = document.createTextNode(
                    textNode.textContent.slice(0, range.startOffset)
                  );
                  const selectedNode = createBlurSpan(
                    textNode.textContent.slice(range.startOffset)
                  );
                  replaceWithNodes(textNode, [beforeNode, selectedNode]);
                }
              }
              // Last of n > 1 text nodes
              else if (textNodeIndex === selectedTextNodes.length - 1) {
                // End container is an element, so pick the first `endOffset` children and select them fully.
                if (range.endContainer.nodeType === Node.ELEMENT_NODE) {
                  replaceWithNodes(
                    textNode,
                    createBlurSpan(textNode.textContent)
                  );
                  // FIXME: why doesn't this work? It ends up selecting script tags
                  // Array.from(range.endContainer.childNodes)
                  //   .slice(0, range.endOffset)
                  //   .forEach((child) => {
                  //     if (!child.textContent) return;
                  //     replaceWithNodes(
                  //       textNode,
                  //       createBlurSpan(child.textContent)
                  //     );
                  //   });
                }
                // End container is a text node, so endOffset represents a character offset within a string
                else if (range.endContainer.nodeType === Node.TEXT_NODE) {
                  // e.g., split [te]xt into "te" (wrapped) and "xt" (unwrapped)
                  const selectedNode = createBlurSpan(
                    textNode.textContent.trimStart().slice(0, range.endOffset)
                  );
                  const afterNode = document.createTextNode(
                    textNode.textContent.trimStart().slice(range.endOffset)
                  );
                  console.log("last node is text", { selectedNode, afterNode });
                  replaceWithNodes(textNode, [selectedNode, afterNode]);
                }
              } else {
                // In-between text nodes (for n > 1) are easy: blur all of them
                replaceWithNodes(
                  textNode,
                  createBlurSpan(textNode.textContent)
                );
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

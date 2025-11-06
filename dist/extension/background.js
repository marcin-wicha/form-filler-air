chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "form-filler_field") {
        chrome.tabs.sendMessage(tab.id, { action: 'fillOutField' });
    }

    if (info.menuItemId === "form-filler_form") {
        chrome.tabs.sendMessage(tab.id, { action: 'fillOutForm' });
    }
});

chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
    const { hasForm, action } = message;

    if (action === 'contextMenuOpened') {
        chrome.contextMenus.update("form-filler_form", {
            enabled: hasForm
        });

        sendResponse({ success: true });
    }
});

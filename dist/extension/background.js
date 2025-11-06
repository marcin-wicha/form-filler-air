chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "form-filler_field") {
        chrome.tabs.sendMessage(tab.id, { action: 'fillOutField' });
    }
});
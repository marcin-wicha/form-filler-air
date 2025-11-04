
chrome.runtime.onInstalled.addListener(async () => {
    const { model } = await chrome.storage.local.get('model');
    chrome.contextMenus.create({
        id: "form-filler_field",
        title: `Fill out field with ${model}`,
        contexts: ["editable"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "form-filler_field") {
        chrome.tabs.sendMessage(tab.id, { action: 'fillOutField' });
    }
});

chrome.runtime.onInstalled.addListener(async () => {
    const { model } = await chrome.storage.local.get('model');
    chrome.contextMenus.create({
        id: "form-filler",
        title: `Fill out form with ${model}`,
        contexts: ["editable"]
    });
});
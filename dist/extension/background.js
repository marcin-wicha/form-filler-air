const MENU_ID_FIELD = "form-filler_field";
const MENU_ID_FORM = "form-filler_form";

function safeCreateMenu(createProps) {
    try {
        chrome.contextMenus.create(createProps, () => void chrome.runtime.lastError);
    }
    catch (_error) {
        // Ignore (e.g. extension context reloaded).
    }
}

function ensureBaseMenusExist() {
    // Create menus early so later update() calls won't fail.
    safeCreateMenu({
        id: MENU_ID_FIELD,
        title: "Fill out field",
        contexts: ["editable"]
    });
    safeCreateMenu({
        id: MENU_ID_FORM,
        title: "Fill out this form",
        contexts: ["editable"],
        enabled: false
    });
}

chrome.runtime.onInstalled?.addListener(() => ensureBaseMenusExist());
chrome.runtime.onStartup?.addListener(() => ensureBaseMenusExist());
// Also run on background load (covers MV2/service-worker restarts).
ensureBaseMenusExist();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === MENU_ID_FIELD) {
        chrome.tabs.sendMessage(tab.id, { action: 'fillOutField' }, () => void chrome.runtime.lastError);
    }
    if (info.menuItemId === MENU_ID_FORM) {
        chrome.tabs.sendMessage(tab.id, { action: 'fillOutForm' }, () => void chrome.runtime.lastError);
    }
});

chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
    const { hasForm, action } = message;
    if (action === 'contextMenuOpened') {
        try {
            chrome.contextMenus.update(MENU_ID_FORM, { enabled: hasForm }, () => void chrome.runtime.lastError);
        }
        catch (_error) {
            // Ignore: menu might not exist yet or extension is reloading.
        }
        sendResponse({ success: true });
    }
});

document.addEventListener("mousedown", (e) => {
    if (e.button === 2) {

        document.querySelectorAll("[data-form-filler-target]").forEach(element => {
            element.removeAttribute("data-form-filler-target");
        });
        e.target.setAttribute("data-form-filler-target", "true");
        chrome.runtime.sendMessage({ action: 'contextMenuOpened', hasForm: Boolean(e.target.form) });
    }
}, true);

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'fillOutField') {
        const targetElement = document.querySelector("[data-form-filler-target='true']");

        if (targetElement) {
            await fillOutField(targetElement);
            targetElement.removeAttribute("data-form-filler-target");
            sendResponse({ success: true });
        }
    }

    if (message.action === 'fillOutForm') {
        const targetElement = document.querySelector("[data-form-filler-target='true']");
        const form = targetElement?.form;
        if (form) {
            await fillOutForm(form);
            targetElement.removeAttribute("data-form-filler-target");
            sendResponse({ success: true });
        }
    }
});


function getContent({ form = '', field = '', labels = '' }) {
    const fieldInput = field ? `<field>${field}</field>` : '';
    const labelsInput = labels ? `<labels>${labels}</labels>` : '';
    const formInput = form ? `<form>${form}</form>` : '';
    return `${fieldInput}${labelsInput}${formInput}`;
}

async function fillOutField(targetElement) {
    const content = getContent({
        field: compressHtml(targetElement.outerHTML),
        labels: getLabelsForElement(targetElement),
        form: compressHtml(targetElement.form.outerHTML)
    });
    const loadingDialog = showLoadingDialog();
    const data = await askForData({ systemPrompt: FIELD_FILLING_SYSTEM_PROMPT, content });
    loadingDialog.close();
    if (!data) return;

    targetElement.value = data;
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
}

async function fillOutForm(form) {
    const content = getContent({
        form: compressHtml(form.outerHTML),
    });
    const loadingDialog = showLoadingDialog();
    const data = await askForData({ systemPrompt: FORM_FILLING_SYSTEM_PROMPT, content });
    loadingDialog.close();
    if (!data) return;

    data.forEach(field => {
        const element = safeQuerySelector(field.field_query_selector);
        if (element) {
            element.value = field.field_value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }
    })
};

function getLabelsForElement(targetElement) {
    return JSON.stringify(Array.from(targetElement.labels ?? []).map((label, index) => `Label ${index + 1}:${label.textContent}`.trim()))
};

/**
 * Safely queries an element using a selector, handling IDs with special characters like colons.
 * If the selector is an ID selector (starts with #), uses getElementById which handles special characters naturally.
 * Otherwise, escapes colons in the selector for querySelector.
 */
function safeQuerySelector(selector) {
    if (!selector) return null;

    // If it's an ID selector, use getElementById which handles colons naturally
    if (selector.startsWith('#')) {
        const id = selector.slice(1); // Remove the #
        return document.getElementById(id);
    }

    // For other selectors, escape colons (CSS special characters)
    // Colons need to be escaped with backslashes in CSS selectors
    const escapedSelector = selector.replace(/:/g, '\\:');
    return document.querySelector(escapedSelector);
}

async function askForData({ systemPrompt, content }) {
    const { model } = await chrome.storage.local.get('model');


    const response = await fetch(`${FORM_FILLER_BACKEND_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            systemPrompt,
            content
        })
    });
    if (!response.ok) return null;

    const payload = await response.json();
    return payload.data ?? null;
}
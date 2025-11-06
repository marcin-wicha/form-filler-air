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
        field: targetElement.outerHTML,
        labels: getLabelsForElement(targetElement),
        form: targetElement.form.outerHTML
    });
    const data = await askForData({ systemPrompt: FIELD_FILLING_SYSTEM_PROMPT, content });
    if (!data) return;

    targetElement.value = data;
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
}

async function fillOutForm(form) {
    const content = getContent({
        form: form.outerHTML,
    });
    const data = await askForData({ systemPrompt: FORM_FILLING_SYSTEM_PROMPT, content });
    if (!data) return;

    data.forEach(field => {
        const element = document.querySelector(field.field_query_selector);
        if (element) {
            element.value = field.field_value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }
    })
};

function getLabelsForElement(targetElement) {
    return JSON.stringify(Array.from(targetElement.labels ?? []).map((label, index) => `Label ${index + 1}:${label.textContent}`.trim()))
};

async function askForData({ systemPrompt, content }) {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    const { model } = await chrome.storage.local.get('model');


    const response = await fetch('https://models.github.ai/inference/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content }]
        })
    });
    const message = await response.json();
    try { return JSON.parse(message.choices[0].message.content).data; } catch (error) { return null; }
}
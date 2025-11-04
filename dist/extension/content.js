const SYSTEM_PROMPT = "You are a helpful assistant that helps the user fill out forms with relevant fake data. You will be supplied with HTML markup for the form field and use that information to establish the format of the data required. The data must be randomized. Answer only with the fake data in JSON format: '{data: <fake data> }'";

document.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
        document.querySelectorAll("[data-form-filler-target]").forEach(element => {
            element.removeAttribute("data-form-filler-target");
        });
        e.target.setAttribute("data-form-filler-target", "true");
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
});

async function fillOutField(targetElement) {
    const data = await askForData(targetElement);
    if (!data) return;

    targetElement.value = data;
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
}

async function askForData(targetElement) {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    const { model } = await chrome.storage.local.get('model');

    const labels = JSON.stringify(Array.from(targetElement.labels ?? []).map((label, index) => `Label ${index + 1}:${label.textContent}`.trim()))

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
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: `Field serialized as HTML: ${targetElement.outerHTML}, Field labels: ${labels}` }]
        })
    });
    const message = await response.json();
    try { return JSON.parse(message.choices[0].message.content).data; } catch (error) { return null; }
}
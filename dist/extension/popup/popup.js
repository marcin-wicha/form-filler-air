const modelSelect = document.getElementById('model');
const apiKeyInput = document.getElementById('apiKey');

chrome.storage.local.get('model', async ({ model }) => {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (model && apiKey) {
        const healthcheckDiv = document.getElementById('healthcheck');
        healthcheckDiv.classList.remove('hidden');
        const form = document.getElementById('form');
        form.classList.add('hidden');
    }
});


modelSelect.addEventListener('change', async (event) => {
    const model = event.target.value;

    if (!model) {
        return;
    }

    const apiKey = apiKeyInput.value;
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
            messages: [{ role: 'system', content: SYSTEM_PROMPT }]
        })
    });
    const data = await response.json();
    if (response.ok) {
        const healthcheckDiv = document.getElementById('healthcheck');
        healthcheckDiv.classList.remove('hidden');
        chrome.storage.local.set({ model: model, apiKey: apiKey });
        chrome.contextMenus.update("form-filler_field", {
            title: `Fill out field with ${model}`
        });
    }
});

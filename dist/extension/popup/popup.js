const modelSelect = document.getElementById('model');
const apiKeyInput = document.getElementById('apiKey');
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
            messages: [{ role: 'system', content: 'You are a helpful assistant that helps the user fill out forms with relevant fake data. You will be supplied with HTML markup for the form field and use that information to establish the format of the data required. The data must be randomized.' }]
        })
    });
    const data = await response.json();
    if (response.ok) {
        const healthcheckDiv = document.getElementById('healthcheck');
        healthcheckDiv.innerHTML = `<p>Setup is complete and ready to use &#x2705; </p>`;

        chrome.storage.local.set({ model: model, apiKey: apiKey });
    }
});

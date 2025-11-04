const modelSelect = document.getElementById('model') as HTMLSelectElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;

modelSelect.addEventListener('change', async (event) => {
    const model = (event.target as HTMLSelectElement).value;
    const apiKey = apiKeyInput.value;

    const response = await fetch('https://models.github.ai/orgs/ORG/inference/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Hello, how are you?' }]
        })
    })

    const data = await response.json();
    console.log(data);
});
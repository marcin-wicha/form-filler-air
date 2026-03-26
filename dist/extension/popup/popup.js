const modelSelect = document.getElementById('model');

chrome.storage.local.get('model', async ({ model }) => {
    if (model) {
        const healthcheckDiv = document.getElementById('healthcheck');
        healthcheckDiv.classList.remove('hidden');
    }

    const response = await fetch(`${FORM_FILLER_BACKEND_BASE_URL}/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) return;

    const models = await response.json();
    const modelSelector = document.getElementById('model');

    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelSelector.appendChild(option);
    });
    modelSelector.removeChild(document.getElementById('loading'));
    if (model) {
        modelSelector.value = model;
    }
});


modelSelect.addEventListener('change', async (event) => {
    const model = event.target.value;

    if (!model) {
        return;
    }

    const response = await fetch(`${FORM_FILLER_BACKEND_BASE_URL}/healthcheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model
        })
    });

    if (response.ok) {
        const healthcheckDiv = document.getElementById('healthcheck');
        healthcheckDiv.classList.remove('hidden');
        chrome.storage.local.set({ model: model });
        // Menus may already exist (created by background on startup). Update if present; otherwise create.
        try {
            chrome.contextMenus.update("form-filler_field", {
                title: `Fill out field with ${model}`
            }, () => {
                if (chrome.runtime.lastError) {
                    chrome.contextMenus.create({
                        id: "form-filler_field",
                        title: `Fill out field with ${model}`,
                        contexts: ["editable"]
                    }, () => void chrome.runtime.lastError);
                }
            });
            chrome.contextMenus.update("form-filler_form", {
                title: `Fill out this form with ${model}`,
                enabled: false
            }, () => {
                if (chrome.runtime.lastError) {
                    chrome.contextMenus.create({
                        id: "form-filler_form",
                        title: `Fill out this form with ${model}`,
                        contexts: ["editable"],
                        enabled: false,
                    }, () => void chrome.runtime.lastError);
                }
            });
        }
        catch (_error) {
            // Ignore: extension context invalidated / runtime unavailable.
        }
    }
});

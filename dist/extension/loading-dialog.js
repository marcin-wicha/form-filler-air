function showLoadingDialog() {
    const dialog = document.createElement('dialog');
    dialog.innerHTML = `
        <style>
            dialog {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: 1.5rem;
                padding: 2rem;
                border: none;
                border-radius: 12px;
                background: white;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                max-width: 300px;
                text-align: center;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                margin: 0;
            }
            
            dialog::backdrop {
                background-color: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(2px);
            }
            
            .spinner {
                width: 48px;
                height: 48px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #4a90e2;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .message {
                margin: 0;
                font-size: 1rem;
                color: #333;
                font-weight: 500;
            }
        </style>
        <div class="spinner"></div>
        <p class="message">Working the magic... &#x1F916;</p>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();

    // Override close to also remove from DOM
    const originalClose = dialog.close.bind(dialog);
    dialog.close = function () {
        originalClose();
        if (dialog.parentNode) {
            dialog.parentNode.removeChild(dialog);
        }
    };

    return dialog;
}
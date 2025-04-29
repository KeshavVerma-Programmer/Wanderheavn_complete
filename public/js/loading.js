document.addEventListener("DOMContentLoaded", () => {
    const fullPageLoader = document.getElementById("fullPageLoader");
    if (fullPageLoader) {
        setTimeout(() => {
            fullPageLoader.classList.add("hidden");
        }, 500); 
    }

    document.querySelectorAll("form").forEach(form => {
        form.addEventListener("submit", (event) => {
            const submitButton = form.querySelector("button[type='submit']");
            if (submitButton) {
                submitButton.classList.add("loading");
                submitButton.disabled = true;
            }
        });
    });
});

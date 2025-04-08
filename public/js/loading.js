document.addEventListener("DOMContentLoaded", () => {
    // Hide full-page loader after the page is fully loaded
    const fullPageLoader = document.getElementById("fullPageLoader");
    if (fullPageLoader) {
        setTimeout(() => {
            fullPageLoader.classList.add("hidden");
        }, 500); // Slight delay for smoother transition
    }

    // Form submission spinner
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

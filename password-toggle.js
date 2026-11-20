const passwordButtons = document.querySelectorAll(
    "[data-password-toggle]"
);

passwordButtons.forEach((button) => {
    const passwordField = button.closest(".password-field");
    const passwordInput = passwordField.querySelector("input");

    button.addEventListener("click", () => {
        const showPassword = passwordInput.type === "password";

        passwordInput.type = showPassword ? "text" : "password";

        button.setAttribute(
            "aria-pressed",
            String(showPassword)
        );

        button.setAttribute(
            "aria-label",
            showPassword ? "Hide password" : "Show password"
        );
    });
});
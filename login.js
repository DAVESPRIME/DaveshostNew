
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document
        .getElementById("login-email")
        .value
        .trim();

    const password = document
        .getElementById("login-password")
        .value;

    const submitButton = loginForm.querySelector(
        'button[type="submit"]'
    );

    const originalText = submitButton.textContent;

    // Clear previous messages.
    loginMessage.textContent = "";
    loginMessage.className = "form-message";

    // Prevent repeated submissions.
    submitButton.disabled = true;
    submitButton.textContent = "Logging in...";

    try {
        const { data, error } =
            await window.supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {
            throw error;
        }

        if (!data.session) {
            throw new Error("Login failed. Please try again.");
        }

        loginMessage.textContent = "Login successful! Opening dashboard...";
        loginMessage.classList.add("success");

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Login error:", error);

        loginMessage.textContent =
            "Login failed. Check your email and password,and confirm your email if required.";

        loginMessage.classList.add("error");

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
});
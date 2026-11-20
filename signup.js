const signupForm = document.getElementById("signup-form");
const signupMessage = document.getElementById("signup-message");

signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const submitButton = signupForm.querySelector(
        'button[type="submit"]'
    );

    const originalText = submitButton.textContent;

    // Clear previous messages.
    signupMessage.textContent = "";
    signupMessage.className = "form-message";

    // Prevent multiple submissions.
    submitButton.disabled = true;
    submitButton.textContent = "Creating account...";

    try {
        const { data, error } =
            await window.supabaseClient.auth.signUp({
                email: email,
                password: password,

                options: {
                    data: {
                        full_name: fullName
                    },

                    emailRedirectTo:
                        window.location.origin + "/login.html"
                }
            });

        if (error) {
            throw error;
        }

        // Email confirmation may be disabled in Supabase.
        if (data.session) {
            signupMessage.textContent =
                "Account created successfully! Redirecting...";

            signupMessage.classList.add("success");

            window.location.href = "dashboard.html";
            return;
        }

        // Email confirmation is enabled.
        signupMessage.textContent =
            "Account created Successfully! Check your email and confirm your address before logging in.";

        signupMessage.classList.add("success");

        signupForm.reset();

    } catch (error) {
        console.error("Signup error:", error);

        signupMessage.textContent =
            error.message || "Registration failed. Please try again.";

        signupMessage.classList.add("error");

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
});
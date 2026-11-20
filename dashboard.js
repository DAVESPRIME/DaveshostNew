(() => {
    const client = window.supabaseClient;

    const logoutButton = document.getElementById("logout-btn");

    const userName = document.getElementById("dashboard-user-name");
    const welcomeName = document.getElementById("dashboard-welcome-name");

    const projectsCount = document.getElementById("projects-count");
    const deploymentsCount = document.getElementById("deployments-count");
    const liveProjectsCount = document.getElementById("live-projects-count");

    const emptyProjects = document.getElementById("projects-empty");
    const projectsList = document.getElementById("projects-list");


    // Check that required dashboard elements exist.
    function checkElements() {
        const elements = {
            userName,
            welcomeName,
            projectsCount,
            deploymentsCount,
            liveProjectsCount,
            emptyProjects,
            projectsList,
            logoutButton
        };

        for (const [name, element] of Object.entries(elements)) {
            if (!element) {
                throw new Error(
                    `Missing dashboard HTML element: ${name}`
                );
            }
        }
    }


    // Format project status.
    function formatStatus(status) {
        const statuses = {
            uploaded: "Uploaded",
            deploying: "Deploying",
            deployed: "Live",
            failed: "Deployment failed"
        };

        return statuses[status] || "Uploaded";
    }


    // Format project date.
    function formatDate(dateString) {
        const date = new Date(dateString);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return new Intl.DateTimeFormat("en", {
            day: "numeric",
            month: "short",
            year: "numeric"
        }).format(date);
    }

// Create-prroject-Cards
 function createProjectCard(project, userId) {

    const card = document.createElement("article");
    card.className = "project-card";

    const top = document.createElement("div");
    top.className = "project-card-top";

    const title = document.createElement("h3");
    title.className = "project-card-title";
    title.textContent = project.name;

    const status = document.createElement("span");
    status.className = `project-status status-${project.status}`;
    status.textContent = formatStatus(project.status);

    top.append(title, status);


    const description = document.createElement("p");
    description.className = "project-card-description";

    description.textContent =
        project.description || "No description added.";


    const date = document.createElement("p");
    date.className = "project-card-date";

    date.textContent =
        `Created: ${formatDate(project.created_at)}`;


    const actions = document.createElement("div");
    actions.className = "project-card-actions";


    if (project.status === "deployed" && project.live_url) {

        const liveLink = document.createElement("a");

        liveLink.href = project.live_url;
        liveLink.target = "_blank";
        liveLink.rel = "noopener noreferrer";
        liveLink.className = "project-live-link";

        liveLink.textContent = "Visit Live Website ↗";

        actions.appendChild(liveLink);

    } else if (project.status === "deploying") {

        const pendingButton = document.createElement("button");

        pendingButton.className = "project-deploy-btn";
        pendingButton.textContent = "Deployment Processing...";
        pendingButton.disabled = true;

        actions.appendChild(pendingButton);

    } else {

        const deployButton = document.createElement("button");

        deployButton.type = "button";
        deployButton.className = "project-deploy-btn";

        deployButton.textContent =
            project.status === "failed"
                ? "Retry Deployment →"
                : "Deploy Project →";

        deployButton.addEventListener("click", () => {
            deployProject(project, deployButton, userId);
        });

        actions.appendChild(deployButton);
    }


    if (project.status === "failed" && project.deploy_error) {

        const errorMessage = document.createElement("p");

        errorMessage.className = "project-card-error";
        errorMessage.textContent =
            `Previous deployment failed: ${project.deploy_error}`;

        card.appendChild(errorMessage);
    }


    card.append(top, description, date, actions);

    return card;
}




// Deploymen-Function
async function deployProject(project, button, userId) {

    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Starting deployment...";

    try {

        console.log("Starting deployment:", project.id);

        const { data, error } =
            await client.functions.invoke(
                "dynamic-api",
                {
                    body: {
                        project_id: project.id
                    }
                }
            );

        if (error) {

            let errorMessage = error.message;

            // Retrieve the actual error returned by the Edge Function.
            if (error.context) {
                try {
                    const details = await error.context.json();

                    errorMessage =
                        details.error ||
                        details.message ||
                        errorMessage;

                } catch {
                    // Keep the original error message.
                }
            }

            throw new Error(errorMessage);
        }

        console.log("Deployment response:", data);

        // Refresh dashboard information.
        await loadProjects(userId);

        if (data.status === "deployed" && data.live_url) {

            alert(
                "Congratulations! Your project is now live!\n\n" +
                data.live_url
            );

        } else {

            alert(
                data.message ||
                "Your project is being processed by Netlify."
            );
        }

    } catch (error) {

        console.error("Deployment error:", error);

        alert("Deployment failed:\n\n" + error.message);

        await loadProjects(userId);

    } finally {

        if (button.isConnected) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}






    // Load projects belonging to the authenticated user.
    async function loadProjects(userId) {
        projectsList.replaceChildren();

        projectsCount.textContent = "0";
        deploymentsCount.textContent = "0";
        liveProjectsCount.textContent = "0";

        const { data: projects, error } = await client
            .from("projects")
            .select("id, name, description, status, created_at, live_url, deploy_error")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Project loading error:", error);

            emptyProjects.hidden = true;
            projectsList.hidden = false;

            const message = document.createElement("p");
            message.className = "projects-error";
            message.textContent =
                "We couldn't load your projects. Please refresh.";

            projectsList.appendChild(message);

            return;
        }

        const projectData = projects || [];

        projectsCount.textContent = projectData.length;

        deploymentsCount.textContent = projectData.filter(
            project =>
                ["deploying", "deployed", "failed"].includes(project.status)
        ).length;

        liveProjectsCount.textContent = projectData.filter(
            project => project.status === "deployed"
        ).length;

        if (projectData.length === 0) {
            emptyProjects.hidden = false;
            projectsList.hidden = true;
            return;
        }

        emptyProjects.hidden = true;
        projectsList.hidden = false;

        const fragment = document.createDocumentFragment();

       projectData.forEach(project => {
    fragment.appendChild(
        createProjectCard(project, userId)
    );
        });

        projectsList.appendChild(fragment);
    }


    // Authenticate and initialize dashboard.
    async function protectDashboard() {

        console.log("DAVESHOST: Starting dashboard authentication.");

        console.log("Website origin:", window.location.origin);

        if (!client) {
            throw new Error("Supabase client was not initialized.");
        }

        checkElements();

        // Check whether a session exists in this browser.
        const { data: sessionData, error: sessionError } =
            await client.auth.getSession();

        if (sessionError) {
            throw new Error(
                "Session error: " + sessionError.message
            );
        }

        const session = sessionData?.session;

        console.log("Saved session exists:", Boolean(session));

        if (!session) {
            throw new Error(
                "No saved login session was found in this browser."
            );
        }

        // Verify the user with Supabase.
        const { data, error } = await client.auth.getUser();

        if (error) {
            throw new Error(
                "User verification failed: " + error.message
            );
        }

        const user = data?.user;

        if (!user) {
            throw new Error("Supabase returned no authenticated user.");
        }

        console.log("Authenticated user:", user.id);

        // Display the user's name.
        const fullName =
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "Developer";

        userName.textContent = fullName;
        welcomeName.textContent = fullName + ".";

        // Reveal the dashboard.
        document.body.classList.remove("auth-checking");

        // Load saved projects.
        await loadProjects(user.id);

        console.log("DAVESHOST: Dashboard initialized successfully.");
    }


    // Handle logout.
    logoutButton.addEventListener("click", async () => {

        logoutButton.disabled = true;
        logoutButton.textContent = "Logging out...";

        try {
            const { error } = await client.auth.signOut({
                scope: "local"
            });

            if (error) {
                throw error;
            }

            window.location.replace("login.html");

        } catch (error) {
            console.error("Logout error:", error);

            alert("Logout failed: " + error.message);

            logoutButton.disabled = false;
            logoutButton.textContent = "Log out";
        }
    });


    // Start dashboard.
    protectDashboard().catch(error => {

        console.error("DAVESHOST DASHBOARD ERROR:", error);

        alert(
            "DavesHost Dashboard Error:\n\n" +
            error.message +
            "\n\nWebsite: " + window.location.origin
        );

        window.location.replace("login.html");
    });

})();
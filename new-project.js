(() => {

    const client = window.supabaseClient;

    const projectForm = document.getElementById("project-form");

    const projectNameInput = document.getElementById("project-name");

    const descriptionInput = document.getElementById("project-description");

    const zipInput = document.getElementById("project-file");

    const folderInput = document.getElementById("project-folder");

    const fileNameDisplay = document.getElementById("file-name");

    const projectMessage = document.getElementById("project-message");

    const submitButton = projectForm.querySelector(
        'button[type="submit"]'
    );


    const MAX_FILE_SIZE = 25 * 1024 * 1024;

    const MAX_FOLDER_SIZE = 100 * 1024 * 1024;

    const MAX_FOLDER_FILES = 1000;


    let selectedZip = null;

    let selectedFolder = [];


    // DISPLAY MESSAGES

    function showMessage(message, type = "") {

        projectMessage.textContent = message;

        projectMessage.className = "form-message";

        if (type) {
            projectMessage.classList.add(type);
        }

    }


    // FORMAT FILE SIZE

    function formatSize(bytes) {

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

    }


    // SELECT ZIP FILE

    zipInput.addEventListener("change", () => {

        selectedFolder = [];
        folderInput.value = "";

        selectedZip = zipInput.files[0] || null;

        showMessage("");

        if (!selectedZip) {
            fileNameDisplay.textContent = "No project selected";
            return;
        }

        if (!selectedZip.name.toLowerCase().endsWith(".zip")) {

            showMessage("Please select a ZIP file.", "error");

            zipInput.value = "";
            selectedZip = null;

            return;

        }

        if (selectedZip.size > MAX_FILE_SIZE) {

            showMessage("Your ZIP exceeds the 25 MB limit.", "error");

            zipInput.value = "";
            selectedZip = null;

            return;

        }

        fileNameDisplay.textContent =
            `${selectedZip.name} (${formatSize(selectedZip.size)})`;

    });


    // SELECT PROJECT FOLDER

    folderInput.addEventListener("change", () => {

        selectedZip = null;
        zipInput.value = "";

        selectedFolder = Array.from(folderInput.files || []);

        showMessage("");

        if (!selectedFolder.length) {

            fileNameDisplay.textContent = "No project selected";

            return;

        }

        if (selectedFolder.length > MAX_FOLDER_FILES) {

            showMessage("Your folder contains too many files.", "error");

            selectedFolder = [];
            folderInput.value = "";

            return;

        }

        const totalSize = selectedFolder.reduce(
            (total, file) => total + file.size,
            0
        );

        if (totalSize > MAX_FOLDER_SIZE) {

            showMessage(
                "Your project folder exceeds the 100 MB preparation limit.",
                "error"
            );

            selectedFolder = [];
            folderInput.value = "";

            return;

        }

        const firstPath = selectedFolder[0].webkitRelativePath;

        if (!firstPath) {

            showMessage(
                "Your browser could not identify the selected folder.",
                "error"
            );

            selectedFolder = [];

            return;

        }

        const folderName = firstPath.split("/")[0];

        // Make sure the folder contains index.html at its root.

        const hasIndex = selectedFolder.some(file => {

            const path = file.webkitRelativePath
                .split("/")
                .slice(1)
                .join("/")
                .toLowerCase();

            return path === "index.html";

        });

        if (!hasIndex) {

            showMessage(
                "Your project folder must contain index.html at its top level.",
                "error"
            );

            selectedFolder = [];

            folderInput.value = "";

            return;

        }

        fileNameDisplay.textContent =
            `${folderName}/ (${selectedFolder.length} files selected)`;

    });


    // CONVERT PROJECT FOLDER INTO ZIP

    async function createFolderZip(files) {

        if (!window.JSZip) {

            throw new Error(
                "ZIP compression library failed to load. Refresh the page and try again."
            );

        }

        const zip = new JSZip();

        const rootFolder = files[0].webkitRelativePath.split("/")[0];

        const safeFolderName = rootFolder.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        );

        for (const file of files) {

            const parts = file.webkitRelativePath.split("/");

            if (parts[0] !== rootFolder) {
                throw new Error("The selected folder contains inconsistent paths.");
            }

            const relativePath = parts.slice(1).join("/");

            if (
                !relativePath ||
                relativePath.split("/").includes("..")
            ) {
                continue;
            }

            // Ignore common macOS metadata.
            if (
                relativePath === ".DS_Store" ||
                relativePath.startsWith("__MACOSX/")
            ) {
                continue;
            }

            zip.file(relativePath, file);

        }

        showMessage("Compressing your project folder...");

        const blob = await zip.generateAsync({

            type: "blob",

            compression: "DEFLATE",

            compressionOptions: {
                level: 6
            }

        });

        if (blob.size === 0) {
            throw new Error("The generated ZIP is empty.");
        }

        if (blob.size > MAX_FILE_SIZE) {

            throw new Error(
                "Your compressed project exceeds the 25 MB upload limit."
            );

        }

        const zipFile = new File(
            [blob],
            `${safeFolderName}.zip`,
            {
                type: "application/zip",
                lastModified: Date.now()
            }
        );

        return zipFile;

    }


    // UPLOAD AND SAVE PROJECT

    projectForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        showMessage("");

        if (!client) {

            showMessage(
                "Supabase connection is unavailable.",
                "error"
            );

            return;

        }

        const projectName = projectNameInput.value.trim();

        const description = descriptionInput.value.trim();

        if (!projectName) {

            showMessage("Enter a project name.", "error");

            return;

        }

        if (!selectedZip && !selectedFolder.length) {

            showMessage(
                "Choose a ZIP file or project folder first.",
                "error"
            );

            return;

        }


        const originalText = submitButton.textContent;

        submitButton.disabled = true;

        let archivePath = null;

        let uploaded = false;


        try {

            // VERIFY USER

            const { data: userData, error: userError } =
                await client.auth.getUser();

            if (userError || !userData.user) {

                window.location.replace("login.html");

                return;

            }

            const user = userData.user;


            // PREPARE THE ARCHIVE

            let archiveFile = selectedZip;

            if (selectedFolder.length) {

                submitButton.textContent = "Compressing folder...";

                archiveFile = await createFolderZip(selectedFolder);

            }

            if (!archiveFile) {

                throw new Error("No valid project archive was selected.");

            }


            // CREATE SAFE STORAGE PATH

            const safeFileName = archiveFile.name.replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            );

            const uniqueId = crypto.randomUUID();

            archivePath =
                `${user.id}/${uniqueId}-${safeFileName}`;


            // UPLOAD ZIP TO SUPABASE

            submitButton.textContent = "Uploading project...";

            const { error: uploadError } = await client.storage
                .from("project-archives")
                .upload(archivePath, archiveFile, {

                    contentType: "application/zip",

                    upsert: false

                });

            if (uploadError) {

                throw new Error(uploadError.message);

            }

            uploaded = true;


            // SAVE PROJECT RECORD

            submitButton.textContent = "Saving project...";

            const { error: databaseError } = await client
                .from("projects")
                .insert({

                    user_id: user.id,

                    name: projectName,

                    description: description || null,

                    archive_path: archivePath,

                    status: "uploaded"

                });

            if (databaseError) {

                throw new Error(databaseError.message);

            }


            // SUCCESS

            showMessage(
                "Project uploaded and saved successfully! It is ready for deployment.",
                "success"
            );

            projectForm.reset();

            selectedZip = null;

            selectedFolder = [];

            fileNameDisplay.textContent = "No project selected";


        } catch (error) {

            console.error("Project upload error:", error);

            // Remove uploaded archive if database saving failed.

            if (uploaded && archivePath) {

                const { error: cleanupError } = await client.storage
                    .from("project-archives")
                    .remove([archivePath]);

                if (cleanupError) {
                    console.error("Cleanup error:", cleanupError);
                }

            }

            showMessage(
                error.message || "Project upload failed. Try again.",
                "error"
            );

        } finally {

            submitButton.disabled = false;

            submitButton.textContent = originalText;

        }

    });

})();
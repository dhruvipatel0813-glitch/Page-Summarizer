function displaySummary(summary) {

    const result = document.getElementById("result");

    // Clear previous result
    result.innerHTML = "";

    // Remove escape characters
    summary = summary.replace(/\\([#*])/g, "$1");

    const lines = summary.split("\n");

    let bulletList = null;

    lines.forEach(line => {

        line = line.trim();

        // Ignore empty lines
        if (!line) {
            return;
        }

        // --------------------------------
        // Detect section headings
        // Examples:
        // - Overview*
        // - Key Points*
        // ### Overview
        // --------------------------------

        let headingText = null;

        if (line.startsWith("###")) {

            headingText = line
                .replace(/^###\s*/, "")
                .replace(/\*+$/, "")
                .trim();

        } else if (/^[-•*]\s*.+\*+$/.test(line)) {

            headingText = line
                 .replace(/^[-•*]\s*/, "")
                 .replace(/^\*+|\*+$/g, "")
                 .trim();
        }

        if (headingText) {

            bulletList = null;

            const heading = document.createElement("h3");

            heading.textContent = headingText;

            heading.className = "summary-heading";

            result.appendChild(heading);

            return;
        }

        // --------------------------------
        // Normal bullet point
        // --------------------------------

        if (
            line.startsWith("•") ||
            line.startsWith("-") ||
            line.startsWith("*")
        ) {

            if (!bulletList) {

                bulletList = document.createElement("ul");

                bulletList.className = "summary-list";

                result.appendChild(bulletList);
            }

            const li = document.createElement("li");

            let text = line.replace(/^[•*-]\s*/, "");

            // Remove bold Markdown
            text = text.replace(/\*\*(.*?)\*\*/g, "$1");

            // Remove italic Markdown
            text = text.replace(/\*(.*?)\*/g, "$1");

            li.textContent = text;

            bulletList.appendChild(li);

            return;
        }

        // --------------------------------
        // Normal paragraph
        // --------------------------------

        bulletList = null;

        const paragraph = document.createElement("p");

        let text = line;

        // Remove bold Markdown
        text = text.replace(/\*\*(.*?)\*\*/g, "$1");

        // Remove italic Markdown
        text = text.replace(/\*(.*?)\*/g, "$1");

        paragraph.textContent = text;

        paragraph.className = "summary-text";

        result.appendChild(paragraph);
    });
}


document
    .getElementById("summarizeBtn")
    .addEventListener("click", async function () {

        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        const currentTab = tabs[0];

        // Extract webpage text
        const results = await chrome.scripting.executeScript({
            target: {
                tabId: currentTab.id
            },

            func: () => {

                // Create a copy of the webpage body
                const clonedBody = document.body.cloneNode(true);

                // Remove elements that are usually not useful
                const unwanted = clonedBody.querySelectorAll(
                    "script, style, nav, footer, header, aside, noscript"
                );

                unwanted.forEach(element => element.remove());

                // Try article first
                const article = clonedBody.querySelector("article");

                let text;

                if (article) {
                    text = article.innerText;
                } 
                else {
                    // Try main
                    const main = clonedBody.querySelector("main");

                    if (main) {
                        text = main.innerText;
                    } 
                    else {
                        // Otherwise use the complete cleaned webpage
                        text = clonedBody.innerText;
                    }
                }

                // Clean excessive whitespace
                text = text
                    .replace(/\n+/g, "\n")
                    .replace(/[ \t]+/g, " ")
                    .trim();

                return text;
            }
        });

        const pageText = results[0].result;

const result = document.getElementById("result");
const button = document.getElementById("summarizeBtn");

result.innerText = "Generating summary...";
button.disabled = true;

try {

    // Send webpage text to backend
    const response = await fetch(
        "http://localhost:3000/summarize",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                text: pageText
            })
        }
    );

    const data = await response.json();

    console.log("Backend response:", data);

    if (response.ok) {

        displaySummary(data.summary);

    } else {

        result.innerText = "Error: " + data.error;
    }

} catch (error) {

    console.log("Connection error:", error);

    result.innerText =
        "Could not connect to the backend.";

} finally {

    button.disabled = false;
}
    });
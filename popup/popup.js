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

        result.innerText = data.summary;

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
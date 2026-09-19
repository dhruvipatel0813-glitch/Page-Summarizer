// require("dotenv").config();

// const express = require("express");
// const cors = require("cors");
// const { GoogleGenAI } = require("@google/genai");

// const app = express();

// const client = new GoogleGenAI({
//     apiKey: process.env.GEMINI_API_KEY
// });

// console.log(
//     "Gemini API key loaded:",
//     !!process.env.GEMINI_API_KEY
// );

// app.use(cors());
// app.use(express.json());

// app.get("/", (req, res) => {
//     res.send("Page Summarizer Backend is running!");
// });

// app.post("/summarize", async (req, res) => {

//     const text = req.body.text;

//     // Check if text exists
//     if (!text) {
//         return res.status(400).json({
//             error: "No text was provided."
//         });
//     }

//     // Check if text is a string
//     if (typeof text !== "string") {
//         return res.status(400).json({
//             error: "Text must be a string."
//         });
//     }

//     // Remove unnecessary whitespace
//     const cleanedText = text.trim();

//     // Check if text is empty
//     if (cleanedText.length === 0) {
//         return res.status(400).json({
//             error: "Text cannot be empty."
//         });
//     }


//     let response;

// try {

//     response = await client.models.generateContent({
//         model: "gemini-3.6-flash",
//         contents: `Summarize the following text in a clear and concise way:

// ${cleanedText}`
//     });

// } catch (error) {

//     console.log("Gemini API error:", error);

//     return res.status(500).json({
//         error: "Gemini API is currently unavailable. Please try again later."
//     });
// }

//     console.log("Received text:");
//     console.log(cleanedText);

//     res.json({
//     summary: response.text
//     });
// });

// app.get("/test-ai", async (req, res) => {

//     const response = await client.models.generateContent({
//         model: "gemini-3.6-flash",
//         contents: "Say hello in one short sentence."
//     });

//     res.json({
//         response: response.text
//     });
// });

// app.listen(3000, () => {
//     console.log("Server running on http://localhost:3000");
// });



require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

console.log(
    "Gemini API key loaded:",
    !!process.env.GEMINI_API_KEY
);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Page Summarizer Backend is running!");
});


function splitIntoChunks(text, chunkSize) {

    const chunks = [];

    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
    }

    return chunks;
}

async function generateWithRetry(prompt, maxRetries = 3) {

    for (let attempt = 1; attempt <= maxRetries; attempt++) {

        try {

            const response = await client.models.generateContent({
                model: "gemini-3.6-flash",
                contents: prompt
            });

            return response;

        } catch (error) {

            console.log(
                `Gemini request failed. Attempt ${attempt} of ${maxRetries}`
            );

            if (error.status === 503) {

                if (attempt === maxRetries) {
                    throw error;
                }

                const delays = [5000, 10000];

                const delay = delays[attempt - 1];

                console.log(`Waiting ${delay / 1000} seconds before retry...`);

                await new Promise(resolve =>
                    setTimeout(resolve, delay)
                );

            } else {

                throw error;
            }
        }
    }
}

app.post("/summarize", async (req, res) => {

    const text = req.body.text;

    // Check if text exists
    if (!text) {
        return res.status(400).json({
            error: "No text was provided."
        });
    }

    // Check if text is a string
    if (typeof text !== "string") {
        return res.status(400).json({
            error: "Text must be a string."
        });
    }

    // Remove unnecessary whitespace
    const cleanedText = text.trim();

    // Check if text is empty
    if (cleanedText.length === 0) {
        return res.status(400).json({
            error: "Text cannot be empty."
        });
    }

    const chunkSize = 10000;

const chunks = splitIntoChunks(cleanedText, chunkSize);

console.log("Total characters:", cleanedText.length);
console.log("Total chunks:", chunks.length);


    let response;

const summaries = [];

try {

    for (let i = 0; i < chunks.length; i++) {

        console.log(`Sending chunk ${i + 1} of ${chunks.length} to Gemini...`);

        const response = await generateWithRetry(
    `Extract the most important information from the following webpage section.

Rules:
- Give 3 to 5 concise bullet points.
- Keep important facts, names, numbers, dates, and technical details.
- Remove repetition and unnecessary wording.
- Do not add information that is not present in the text.
- Focus only on information useful for understanding the webpage.

Webpage section:

${chunks[i]}`
);

        summaries.push(response.text);

        console.log(`Chunk ${i + 1} summarized successfully.`);
    }

} catch (error) {

    console.log("Gemini API error:", error);

    return res.status(500).json({
        error: "Gemini API is currently unavailable. Please try again later."
    });
}

    console.log("All chunks summarized successfully.");

    const combinedText = summaries.join("\n\n");

const finalResponse = await generateWithRetry(
    `Create a final summary of the webpage using the section summaries below.

Instructions:
- Start with a short overview of what the webpage is about.
- Then provide the most important points as bullet points.
- Combine related information from different sections.
- Remove duplicate or repetitive information.
- Preserve important facts, names, numbers, dates, and technical details.
- Do not add information that is not present in the section summaries.
- Keep the final summary concise but informative.
- Make the result easy to read.
- Do not mention that the webpage was divided into sections or chunks.

Section summaries:

${combinedText}`
);

res.json({
    summary: finalResponse.text
});
});

app.get("/test-ai", async (req, res) => {

    const response = await client.models.generateContent({
        model: "gemini-3.6-flash",
        contents: "Say hello in one short sentence."
    });

    res.json({
        response: response.text
    });
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
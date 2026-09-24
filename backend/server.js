require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");
const Groq = require("groq-sdk");

const app = express();

const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

console.log(
    "Gemini API key loaded:",
    !!process.env.GEMINI_API_KEY
);

console.log(
    "Groq API key loaded:",
    !!process.env.GROQ_API_KEY
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

async function generateWithGroq(prompt) {

    const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [
            {
                role: "user",
                content: prompt
            }
        ]
    });

    return response.choices[0].message.content;
}

async function generateWithFallback(prompt) {

    try {

        console.log("Trying Gemini...");

        const response = await generateWithRetry(prompt);

        console.log("Gemini succeeded.");

        return response.text;

    } catch (error) {

        console.log("Gemini failed.");
        console.log("Switching to Groq...");

        try {

            const response = await generateWithGroq(prompt);

            console.log("Groq succeeded.");

            return response;

        } catch (groqError) {

            console.log("Groq also failed.");

            throw groqError;
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

    // Clean text
    const cleanedText = text.trim();

    // Check if text is empty
    if (cleanedText.length === 0) {
        return res.status(400).json({
            error: "Text cannot be empty."
        });
    }

    console.log("Total characters:", cleanedText.length);

    /*
     * NORMAL WEBPAGE
     *
     * If the webpage is small enough, send it directly
     * to Gemini in ONE request.
     */

    const normalPageLimit = 25000;

    if (cleanedText.length <= normalPageLimit) {

        console.log("Normal webpage detected.");
        console.log("Sending one request to Gemini...");

        try {

            const response = await generateWithFallback(
                `Summarize the following webpage.

Instructions:
- Start with a short section called "Overview".
- Then provide a section called "Key Highlights".
- Use concise bullet points.
- Preserve important facts, names, numbers, dates, and technical details.
- Remove repetition and unnecessary wording.
- Do not add information that is not present in the webpage.
- Make the summary easy to scan and understand.
- Do not mention that you are summarizing webpage text.

Webpage:

${cleanedText}`
            );

            console.log("Webpage summarized successfully.");

            return res.json({
                summary: response
            });

        } catch (error) {

            console.log("Gemini API error:", error);

            return res.status(500).json({
                error: "Gemini API is currently unavailable. Please try again later."
            });
        }
    }


    /*
     * LONG WEBPAGE
     *
     * For larger webpages, divide the content into
     * larger chunks and summarize each chunk.
     */

    const chunkSize = 15000;

    const chunks = splitIntoChunks(
        cleanedText,
        chunkSize
    );

    console.log("Long webpage detected.");
    console.log("Total chunks:", chunks.length);

    const summaries = [];

    try {

        for (let i = 0; i < chunks.length; i++) {

            console.log(
                `Sending chunk ${i + 1} of ${chunks.length} to Gemini...`
            );

            const response = await generateWithFallback(
                `Extract the most important information from the following webpage section.

Instructions:
- Give only the most important information.
- Use concise bullet points.
- Preserve important facts, names, numbers, dates, and technical details.
- Remove repetition and unnecessary wording.
- Do not add information that is not present in the text.
- Keep the response short.

Webpage section:

${chunks[i]}`
            );

            summaries.push(response);

            console.log(
                `Chunk ${i + 1} summarized successfully.`
            );
        }

    } catch (error) {

        console.log("Gemini API error:", error);

        return res.status(500).json({
            error: "Gemini API is currently unavailable. Please try again later."
        });
    }


    /*
     * FINAL SUMMARY
     *
     * Combine the smaller chunk summaries into one
     * final response.
     */

    const combinedText = summaries.join("\n\n");

    console.log(
        "Combined summary characters:",
        combinedText.length
    );

    try {

        const finalResponse = await generateWithFallback(
            `Create a final summary of the webpage using the information below.

Instructions:
- Start with a short section called "Overview".
- Then provide a section called "Key Highlights".
- Use concise bullet points.
- Combine related information.
- Remove duplicate information.
- Preserve important facts, names, numbers, dates, and technical details.
- Do not add information that is not present in the provided information.
- Make the final result concise and easy to scan.
- Do not mention chunks or sections.

Information:

${combinedText}`
        );

        console.log("Final summary generated successfully.");

        return res.json({
            summary: finalResponse
        });

    } catch (error) {

        console.log("Final Gemini request failed:", error);

        return res.status(500).json({
            error: "Gemini is currently unavailable while creating the final summary."
        });
    }
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

app.get("/test-groq", async (req, res) => {

    try {

        const response = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: [
                {
                    role: "user",
                    content: "Say hello in one short sentence."
                }
            ]
        });

        res.json({
            response: response.choices[0].message.content
        });

    } catch (error) {

        console.log("Groq API error:", error);

        res.status(500).json({
            error: "Groq API request failed."
        });
    }
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
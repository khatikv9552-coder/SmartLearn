const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// =====================================================
// GEMINI AI
// API key Render Environment Variable मधून घेतली जाते.
// API key इथे कधीही लिहू नका.
// =====================================================

const gemini = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const GEMINI_MODEL = "gemini-3.8-flash";

// Primary + fallback models
const GEMINI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash"
];

const MAX_RETRIES_PER_MODEL = 2;


// =====================================================
// DELAY FUNCTION
// =====================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// =====================================================
// CHECK TEMPORARY GEMINI ERROR
// =====================================================

function isTemporaryGeminiError(error) {

    const code = Number(
        error?.status ??
        error?.code ??
        error?.response?.status ??
        0
    );

    const message = String(
        error?.message ||
        error ||
        ""
    );

    return (
        [429, 500, 502, 503, 504].includes(code) ||
        /high demand|unavailable|temporar|overload|rate.?limit|resource.?exhausted/i.test(message)
    );
}


// =====================================================
// GEMINI WITH RETRY + FALLBACK
// =====================================================

async function generateWithFallback(contents, isVision = false) {

    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
    }

    let lastError = null;

    for (const model of GEMINI_MODELS) {

        for (
            let attempt = 1;
            attempt <= MAX_RETRIES_PER_MODEL;
            attempt++
        ) {

            try {

                console.log(
                    `${isVision ? "Vision" : "Text"} request -> ${model} (attempt ${attempt})`
                );

                const response =
                    await gemini.models.generateContent({
                        model: model,
                        contents: contents
                    });

                if (!response || !response.text) {
                    throw new Error(
                        `No response from Gemini (${model})`
                    );
                }

                console.log(
                    `Gemini response received from ${model}`
                );

                return response.text;

            } catch (error) {

                lastError = error;

                console.error(
                    `Gemini ${model} attempt ${attempt} failed:`,
                    error?.message || error
                );

                // Temporary error असल्यासच retry/fallback
                if (!isTemporaryGeminiError(error)) {
                    throw error;
                }

                if (attempt < MAX_RETRIES_PER_MODEL) {

                    await sleep(
                        1200 * attempt
                    );
                }
            }
        }

        console.log(
            `Trying Gemini fallback model after ${model}...`
        );
    }

    throw (
        lastError ||
        new Error("All Gemini models failed")
    );
}


// =====================================================
// TEXT AI
// =====================================================

async function askGemini(prompt) {

    return generateWithFallback(
        prompt,
        false
    );
}


// =====================================================
// IMAGE + TEXT AI
// Theory handwritten answer checking
// =====================================================

async function askGeminiWithImage(
    prompt,
    imageBase64
) {

    const cleanImage =
        imageBase64.replace(
            /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
            ""
        );

    const mimeMatch =
        imageBase64.match(
            /^data:(image\/[a-zA-Z0-9.+-]+);base64,/
        );

    const mimeType =
        mimeMatch
            ? mimeMatch[1]
            : "image/jpeg";


    const contents = [

        {
            inlineData: {
                mimeType: mimeType,
                data: cleanImage
            }
        },

        {
            text: prompt
        }

    ];


    return generateWithFallback(
        contents,
        true
    );
}


// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {

    res.json({

        status: "online",

        app: "SmartLearn AI Server",

        ai: "Gemini",

        model: GEMINI_MODEL,

        fallbackModels:
            GEMINI_MODELS.slice(1)

    });

});


// =====================================================
// AI ASSISTANT
// =====================================================

app.post("/ask-ai", async (req, res) => {

    try {

        const question =
            req.body.question || "";

        const profile =
            req.body.profile || {};

        const subject =
            req.body.subject || "";

        const topic =
            req.body.topic || "";


        // Empty question check
        if (!question.trim()) {

            return res.status(400).json({

                error:
                    "Question is required"

            });

        }


        // =================================================
        // STUDENT EDUCATION
        // =================================================

        const education =

            profile.educationLevel === "school"

                ?

                `School, Standard: ${profile.standard || ""},
Board: ${profile.board || ""}`

                :

                `College/University,
Course: ${profile.course || ""},
Branch: ${profile.branch || ""},
Year: ${profile.collegeYear || ""},
University: ${profile.university || ""}`;


        // =================================================
        // AI PROMPT
        // =================================================

        const prompt = `

You are SmartLearn AI, a personal educational assistant.

STUDENT PROFILE:

Name:
${profile.name || "Student"}

Education:
${education}

Medium:
${profile.medium || "English"}

Goal:
${profile.goal || "General Learning"}


CURRENT LEARNING:

Subject:
${subject || "General"}

Topic:
${topic || "General"}


STUDENT QUESTION:

${question}


IMPORTANT ANSWER RULES:

1. Answer the student's question correctly.

2. Adjust the answer according to the student's education level.

3. Use simple language suitable for the student.

4. Answer ONLY what the question asks.

5. The answer length must be proportional to the question.

6. If the question asks for a definition, give a concise definition.

7. If the question asks for a short answer, give only a short answer.

8. If the question asks to explain something, give the required explanation but do not add unnecessary information.

9. If the question asks for steps, give only the necessary steps.

10. Do NOT automatically add examples.

11. Do NOT automatically add advantages or disadvantages.

12. Do NOT automatically add summary or conclusion.

13. Do NOT add headings unless they are necessary.

14. Do NOT repeat the question.

15. Do NOT start with "Sure", "Of course", "Here is the answer", etc.

16. Do NOT make a simple question into a long answer.

17. Do NOT make the answer shorter if the question clearly requires explanation.

18. Give enough information to completely answer the question.

19. Respect the student's selected medium when practical.

20. Do not refuse a normal educational question.

21. Do not invent facts.

22. Return ONLY the final answer.

FINAL RULE:

Give the student exactly the amount of information required to correctly answer the question.

`;


        // =================================================
        // GET AI ANSWER
        // =================================================

        const answer =
            await askGemini(prompt);


        // =================================================
        // SEND ANSWER
        // =================================================

        res.json({

            answer: answer

        });


    } catch (error) {

        console.error(
            "AI Assistant Error:",
            error
        );


        res.status(500).json({

            error:
                "AI server error",

            details:
                error.message

        });

    }

});


// =====================================================
// THEORY HANDWRITTEN ANSWER CHECKING
// =====================================================

app.post(
    "/check-theory-answer",
    async (req, res) => {

        try {

            const question =
                req.body.question || "";

            const expectedAnswer =
                req.body.expectedAnswer || "";

            const imageBase64 =
                req.body.imageBase64 || "";

            const studentAnswer =
                req.body.studentAnswer || "";

            const profile =
                req.body.profile || {};

            const subject =
                req.body.subject || "";

            const topic =
                req.body.topic || "";


            // =================================================
            // QUESTION CHECK
            // =================================================

            if (!question) {

                return res.status(400).json({

                    error:
                        "Question is required"

                });

            }


            // =================================================
            // ANSWER CHECK
            // =================================================

            if (
                !imageBase64 &&
                !studentAnswer
            ) {

                return res.status(400).json({

                    error:
                        "Answer photo or answer text is required"

                });

            }


            // =================================================
            // STUDENT EDUCATION
            // =================================================

            const education =

                profile.educationLevel === "school"

                    ?

                    `
School Student

Standard:
${profile.standard || "Not specified"}

Board:
${profile.board || "Not specified"}

Medium:
${profile.medium || "English"}

School:
${profile.school || "Not specified"}
`

                    :

                    `
College Student

Course:
${profile.course || ""}

Branch:
${profile.branch || ""}

Year:
${profile.collegeYear || ""}

University:
${profile.university || ""}

Medium:
${profile.medium || "English"}
`;


            // =================================================
            // HANDWRITTEN PHOTO CHECKING
            // =================================================

            if (imageBase64) {

                const visionPrompt = `

You are SmartLearn AI, an educational answer evaluator.


STUDENT INFORMATION:

${education}


SUBJECT:

${subject}


TOPIC:

${topic}


QUESTION:

${question}


MODEL / EXPECTED ANSWER:

${
    expectedAnswer ||
    "Evaluate using the correct concepts for this question."
}


The attached image contains the student's handwritten answer.

Read the handwritten answer carefully.


Evaluate the student's answer based on:

- correctness
- important concepts
- key points
- completeness
- understanding of the topic
- whether the answer actually addresses the question


IMPORTANT:

Do NOT judge handwriting style.

Do NOT give marks only based on answer length.

Grammar mistakes should not be heavily penalized if the concept is correct.

Give partial marks when appropriate.


TOTAL MARKS = 5.


Return ONLY valid JSON in exactly this format:

{
    "marks": 0,
    "totalMarks": 5,
    "correctPoints": [],
    "missingPoints": [],
    "wrongPoints": [],
    "feedback": "",
    "improvement": ""
}


Rules:

- marks must be a number from 0 to 5.
- correctPoints must contain correctly written points.
- missingPoints must contain important missing points.
- wrongPoints must contain incorrect concepts.
- feedback should briefly explain the result.
- improvement should give practical advice.

`;


                const raw =
                    await askGeminiWithImage(
                        visionPrompt,
                        imageBase64
                    );


                const cleaned =
                    raw
                        .replace(
                            /```json/gi,
                            ""
                        )
                        .replace(
                            /```/g,
                            ""
                        )
                        .trim();


                let result;


                try {

                    result =
                        JSON.parse(cleaned);

                } catch (error) {

                    console.log(
                        "Gemini vision returned non-JSON:",
                        raw
                    );


                    result = {

                        marks: 0,

                        totalMarks: 5,

                        correctPoints: [],

                        missingPoints: [],

                        wrongPoints: [],

                        feedback: raw,

                        improvement:
                            "Try to include all important points from the topic."

                    };

                }


                return res.json({

                    status:
                        "checked",

                    marks:
                        Math.max(
                            0,
                            Math.min(
                                5,
                                Number(
                                    result.marks
                                ) || 0
                            )
                        ),

                    totalMarks: 5,

                    correctPoints:
                        Array.isArray(
                            result.correctPoints
                        )
                            ?
                            result.correctPoints
                            :
                            [],

                    missingPoints:
                        Array.isArray(
                            result.missingPoints
                        )
                            ?
                            result.missingPoints
                            :
                            [],

                    wrongPoints:
                        Array.isArray(
                            result.wrongPoints
                        )
                            ?
                            result.wrongPoints
                            :
                            [],

                    feedback:
                        result.feedback || "",

                    improvement:
                        result.improvement || ""

                });

            }


            // =================================================
            // TYPED THEORY ANSWER CHECKING
            // =================================================

            const prompt = `

You are SmartLearn AI evaluating a student's theory answer.


STUDENT EDUCATION:

${education}


SUBJECT:

${subject}


TOPIC:

${topic}


QUESTION:

${question}


EXPECTED ANSWER:

${
    expectedAnswer ||
    "Evaluate using correct concepts for the question."
}


STUDENT ANSWER:

${studentAnswer}


TASK:

Evaluate the student's answer fairly.


RULES:

1. Give a score from 0 to 5.

2. Award partial marks when some concepts are correct.

3. Do not judge grammar harshly if the concept is correct.

4. Identify correct points.

5. Identify missing important points.

6. Identify incorrect points.

7. Give simple feedback.

8. Give one improvement suggestion.


Return ONLY valid JSON:

{
    "marks": 0,
    "totalMarks": 5,
    "correctPoints": [],
    "missingPoints": [],
    "wrongPoints": [],
    "feedback": "",
    "improvement": ""
}

`;


            const raw =
                await askGemini(prompt);


            const cleaned =
                raw
                    .replace(
                        /```json/gi,
                        ""
                    )
                    .replace(
                        /```/g,
                        ""
                    )
                    .trim();


            let result;


            try {

                result =
                    JSON.parse(cleaned);

            } catch (error) {

                result = {

                    marks: 0,

                    totalMarks: 5,

                    correctPoints: [],

                    missingPoints: [],

                    wrongPoints: [],

                    feedback: raw,

                    improvement:
                        "Try to include all important points."

                };

            }


            res.json({

                status:
                    "checked",

                marks:
                    Math.max(
                        0,
                        Math.min(
                            5,
                            Number(
                                result.marks
                            ) || 0
                        )
                    ),

                totalMarks: 5,

                correctPoints:
                    Array.isArray(
                        result.correctPoints
                    )
                        ?
                        result.correctPoints
                        :
                        [],

                missingPoints:
                    Array.isArray(
                        result.missingPoints
                    )
                        ?
                        result.missingPoints
                        :
                        [],

                wrongPoints:
                    Array.isArray(
                        result.wrongPoints
                    )
                        ?
                        result.wrongPoints
                        :
                        [],

                feedback:
                    result.feedback || "",

                improvement:
                    result.improvement || ""

            });


        } catch (error) {

            console.error(
                "Theory checking error:",
                error
            );


            res.status(500).json({

                error:
                    "Theory answer checking failed",

                details:
                    error.message

            });

        }

    }
);


// =====================================================
// START SERVER
// =====================================================

const PORT =
    process.env.PORT || 5000;


app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `SmartLearn AI Server running on port ${PORT}`
        );

        console.log(
            `Gemini Model: ${GEMINI_MODEL}`
        );

        console.log(
            `Fallback Models: ${GEMINI_MODELS.slice(1).join(", ")}`
        );

    }
);
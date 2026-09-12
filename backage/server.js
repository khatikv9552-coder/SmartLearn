const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));


// =====================================================
// OLLAMA TEXT MODEL
// =====================================================

async function askOllama(prompt) {

    const response = await fetch(
        "http://localhost:11434/api/generate",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                model: "llama3.2",
                prompt: prompt,
                stream: false
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {

        throw new Error(
            data.error || "Ollama text model error"
        );
    }

    if (!data.response) {

        throw new Error(
            "No response from Ollama"
        );
    }

    return data.response;
}


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


        const education =
            profile.educationLevel === "school"

                ? `
School Student
Standard: ${profile.standard || ""}
Board: ${profile.board || ""}
Medium: ${profile.medium || "English"}
`

                : `
College/University Student
Course: ${profile.course || ""}
Branch: ${profile.branch || ""}
Year: ${profile.collegeYear || ""}
University: ${profile.university || ""}
Medium: ${profile.medium || "English"}
`;


        const prompt = `
You are SmartLearn AI, a personal educational assistant.

STUDENT PROFILE:

Name:
${profile.name || "Student"}

Education:
${education}

Goal:
${profile.goal || "General Learning"}


CURRENT LEARNING:

Subject:
${subject || "General"}

Topic:
${topic || "General"}


STUDENT QUESTION:

${question}


INSTRUCTIONS:

1. Answer the student's question correctly.

2. Adjust the explanation to the student's education level.

3. Use simple language appropriate for the student.

4. Give a short example when useful.

5. Explain step-by-step when required.

6. If the question is educational, teach the concept clearly.

7. Do not unnecessarily make the answer very long.

Give only the answer to the student.
`;


        const answer =
            await askOllama(prompt);


        res.json({
            answer: answer
        });

    }

    catch (error) {

        console.error(
            "AI Assistant error:",
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


            // -------------------------------------------------
            // CHECK QUESTION
            // -------------------------------------------------

            if (!question) {

                return res.status(400).json({

                    error:
                        "Question is required"

                });

            }


            // -------------------------------------------------
            // CHECK ANSWER
            // -------------------------------------------------

            if (!imageBase64 && !studentAnswer) {

                return res.status(400).json({

                    error:
                        "Answer photo or answer text is required"

                });

            }


            // =================================================
            // STUDENT EDUCATION INFORMATION
            // =================================================

            const education =
                profile.educationLevel === "school"

                    ? `
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

                    : `
College / University Student

Course:
${profile.course || "Not specified"}

Branch:
${profile.branch || "Not specified"}

Year:
${profile.collegeYear || "Not specified"}

University:
${profile.university || "Not specified"}

Medium:
${profile.medium || "English"}
`;


            // =================================================
            // HANDWRITTEN PHOTO CHECKING
            // =================================================

            if (imageBase64) {

                console.log(
                    "\n======================================"
                );

                console.log(
                    "HANDWRITTEN ANSWER CHECK STARTED"
                );

                console.log(
                    "Image Base64 length:",
                    imageBase64.length
                );

                console.log(
                    "Model: gemma3:4b"
                );

                console.log(
                    "======================================\n"
                );


                const visionPrompt = `

You are SmartLearn AI, an educational answer evaluator.

You are evaluating a student's handwritten answer from an image.


STUDENT INFORMATION:

${education}


SUBJECT:

${subject}


TOPIC:

${topic}


QUESTION:

${question}


EXPECTED / MODEL ANSWER:

${expectedAnswer ||
"Evaluate the answer using the correct concepts for this question."
}


IMPORTANT:

The attached image contains the student's handwritten answer.

Read the handwriting carefully.

First understand what the student has written.

Then evaluate the answer.


EVALUATION CRITERIA:

1. Correctness

2. Important concepts

3. Key points

4. Completeness

5. Understanding of the topic

6. Whether the answer actually addresses the question


IMPORTANT RULES:

- Do NOT judge handwriting style.

- Do NOT reduce marks because handwriting is beautiful or poor.

- Do NOT give marks only based on answer length.

- Grammar mistakes should not be heavily penalized if the concept is correct.

- Give partial marks when appropriate.

- If the student has written a correct concept in different words, consider it correct.

- If the answer is incomplete, identify the missing points.

- If the answer contains incorrect information, identify the wrong points.

- Read the complete image before evaluating.


TOTAL MARKS = 5


RETURN ONLY VALID JSON.

Do NOT use markdown.

Do NOT use code fences.

Use exactly this structure:

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


                // =================================================
                // SEND IMAGE TO GEMMA 3 VISION
                // =================================================

                const cleanImage =
                    imageBase64.replace(
                        /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
                        ""
                    );


                const response =
                    await fetch(
                        "http://localhost:11434/api/generate",
                        {

                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({

                                model:
                                    "gemma3:4b",

                                prompt:
                                    visionPrompt,

                                images: [
                                    cleanImage
                                ],

                                stream:
                                    false

                            })

                        }
                    );


                const data =
                    await response.json();


                console.log(
                    "\n========== GEMMA 3 RESPONSE =========="
                );

                console.log(
                    "HTTP Status:",
                    response.status
                );

                console.log(
                    JSON.stringify(
                        data,
                        null,
                        2
                    )
                );

                console.log(
                    "=======================================\n"
                );


                // -------------------------------------------------
                // OLLAMA ERROR
                // -------------------------------------------------

                if (!response.ok) {

                    throw new Error(
                        data.error ||
                        "Gemma 3 vision request failed"
                    );

                }


                if (!data.response) {

                    throw new Error(
                        "No response from gemma3:4b"
                    );

                }


                // =================================================
                // CLEAN AI RESPONSE
                // =================================================

                const cleaned =
                    data.response

                        .replace(
                            /```json/gi,
                            ""
                        )

                        .replace(
                            /```/g,
                            ""
                        )

                        .trim();


                console.log(
                    "Cleaned AI response:",
                    cleaned
                );


                // =================================================
                // CONVERT RESPONSE TO JSON
                // =================================================

                let result;


                try {

                    result =
                        JSON.parse(cleaned);

                }

                catch (jsonError) {

                    console.log(
                        "Gemma returned non-JSON response."
                    );


                    result = {

                        marks: 0,

                        totalMarks: 5,

                        correctPoints: [],

                        missingPoints: [],

                        wrongPoints: [],

                        feedback:
                            data.response,

                        improvement:
                            "Please include all important points from the topic."

                    };

                }


                // =================================================
                // SEND RESULT TO FRONTEND
                // =================================================

                return res.json({

                    status:
                        "checked",

                    marks:
                        Number(result.marks) || 0,

                    totalMarks:
                        5,

                    correctPoints:
                        Array.isArray(
                            result.correctPoints
                        )
                            ? result.correctPoints
                            : [],

                    missingPoints:
                        Array.isArray(
                            result.missingPoints
                        )
                            ? result.missingPoints
                            : [],

                    wrongPoints:
                        Array.isArray(
                            result.wrongPoints
                        )
                            ? result.wrongPoints
                            : [],

                    feedback:
                        result.feedback || "",

                    improvement:
                        result.improvement || ""

                });

            }


            // =================================================
            // TYPED ANSWER CHECKING
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

${expectedAnswer ||
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
                await askOllama(prompt);


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

            }

            catch (error) {

                result = {

                    marks: 0,

                    totalMarks: 5,

                    correctPoints: [],

                    missingPoints: [],

                    wrongPoints: [],

                    feedback:
                        raw,

                    improvement:
                        "Try to include all important points."

                };

            }


            res.json({

                status:
                    "checked",

                marks:
                    Number(result.marks) || 0,

                totalMarks:
                    5,

                correctPoints:
                    Array.isArray(
                        result.correctPoints
                    )
                        ? result.correctPoints
                        : [],

                missingPoints:
                    Array.isArray(
                        result.missingPoints
                    )
                        ? result.missingPoints
                        : [],

                wrongPoints:
                    Array.isArray(
                        result.wrongPoints
                    )
                        ? result.wrongPoints
                        : [],

                feedback:
                    result.feedback || "",

                improvement:
                    result.improvement || ""

            });

        }


        catch (error) {

            console.error(
                "\nTheory checking error:",
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

app.listen(
    5000,
    () => {

        console.log(
            "SmartLearn AI Server running on http://localhost:5000"
        );

        console.log(
            "Theory Vision Model: gemma3:4b"
        );

    }
);
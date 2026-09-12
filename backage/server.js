const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));


// =====================================================
// GEMINI AI CONFIGURATION
// =====================================================

const gemini = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const GEMINI_MODEL = "gemini-3.8-flash";


// =====================================================
// GEMINI TEXT AI
// =====================================================

async function askGemini(prompt) {

    if (!process.env.GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is not configured"
        );
    }

    const response =
        await gemini.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt
        });

    if (
        !response ||
        !response.text
    ) {
        throw new Error(
            "No response from Gemini"
        );
    }

    return response.text;
}


// =====================================================
// GEMINI IMAGE + TEXT AI
// Used for handwritten answer checking
// =====================================================

async function askGeminiWithImage(
    prompt,
    imageBase64
) {

    if (!process.env.GEMINI_API_KEY) {
        throw new Error(
            "GEMINI_API_KEY is not configured"
        );
    }

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


    const response =
        await gemini.models.generateContent({

            model: GEMINI_MODEL,

            contents: [

                {
                    inlineData: {
                        mimeType: mimeType,
                        data: cleanImage
                    }
                },

                {
                    text: prompt
                }

            ]

        });


    if (
        !response ||
        !response.text
    ) {

        throw new Error(
            "No response from Gemini vision"
        );

    }

    return response.text;
}



// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", (req, res) => {

    res.json({

        status: "online",

        app: "SmartLearn AI Server",

        ai: "Gemini",

        model: GEMINI_MODEL

    });

});



// =====================================================
// AI ASSISTANT
// =====================================================

app.post(
    "/ask-ai",
    async (req, res) => {

        try {

            const question =
                req.body.question || "";

            const profile =
                req.body.profile || {};

            const subject =
                req.body.subject || "";

            const topic =
                req.body.topic || "";


            if (!question.trim()) {

                return res.status(400).json({

                    error:
                        "Question is required"

                });

            }


            // =========================================
            // STUDENT EDUCATION INFORMATION
            // =========================================

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

College:
${profile.college || "Not specified"}
`;



            // =========================================
            // AI PROMPT
            // =========================================

            const prompt = `

You are SmartLearn AI,
a personal educational assistant.

================================================
STUDENT PROFILE
================================================

Name:
${profile.name || "Student"}

Education:
${education}

Goal:
${profile.goal || "General Learning"}


================================================
CURRENT LEARNING
================================================

Subject:
${subject || "General"}

Topic:
${topic || "General"}


================================================
STUDENT QUESTION
================================================

${question}


================================================
INSTRUCTIONS
================================================

1. Answer the student's question correctly.

2. Adjust the explanation according to
   the student's education level.

3. Use simple language.

4. Respect the student's selected
   language/medium whenever practical.

5. Give examples when useful.

6. Explain step-by-step when required.

7. If the question is educational,
   teach the concept clearly.

8. Do not unnecessarily make the
   answer extremely long.

9. Do not refuse normal educational
   questions.

10. Do not invent facts.

11. If the student asks a numerical
    problem, solve it step-by-step.

12. If the student asks for a definition,
    give definition + explanation +
    suitable example.

13. If the student asks about a concept,
    explain it at their level.

================================================

Give only the answer to the student.

`;



            const answer =
                await askGemini(prompt);


            res.json({

                answer: answer

            });

        }


        catch (error) {

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

    }
);



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



            // =========================================
            // VALIDATION
            // =========================================

            if (!question) {

                return res.status(400).json({

                    error:
                        "Question is required"

                });

            }


            if (
                !imageBase64 &&
                !studentAnswer
            ) {

                return res.status(400).json({

                    error:
                        "Answer photo or answer text is required"

                });

            }



            // =========================================
            // EDUCATION INFORMATION
            // =========================================

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


                const visionPrompt = `

You are SmartLearn AI,
an educational theory-answer evaluator.

================================================
STUDENT INFORMATION
================================================

${education}


================================================
SUBJECT
================================================

${subject}


================================================
TOPIC
================================================

${topic}


================================================
QUESTION
================================================

${question}


================================================
MODEL / EXPECTED ANSWER
================================================

${
    expectedAnswer ||
    "Evaluate using the correct concepts for this question."
}


================================================
STUDENT ANSWER IMAGE
================================================

The attached image contains
the student's handwritten answer.

Read the handwritten answer carefully.

Evaluate the student's answer based on:

- correctness
- important concepts
- key points
- completeness
- understanding
- relevance to the question


================================================
IMPORTANT RULES
================================================

1. Do NOT judge handwriting style.

2. Do NOT give marks simply based
   on answer length.

3. Grammar mistakes should not be
   heavily penalized if the concept
   is correct.

4. Give partial marks when appropriate.

5. Check whether the student actually
   answered the question.

6. Identify correct concepts.

7. Identify missing concepts.

8. Identify incorrect concepts.

9. Give useful improvement feedback.


================================================
MARKING
================================================

TOTAL MARKS = 5


================================================
OUTPUT
================================================

Return ONLY valid JSON.

Do not write Markdown.

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


IMPORTANT:

marks must be between 0 and 5.

correctPoints must contain
the concepts correctly written
by the student.

missingPoints must contain
important concepts that are missing.

wrongPoints must contain
incorrect concepts or statements.

feedback must explain the
student's performance briefly.

improvement must give practical
suggestions for improvement.

`;



                const raw =
                    await askGeminiWithImage(
                        visionPrompt,
                        imageBase64
                    );



                // =====================================
                // CLEAN AI JSON
                // =====================================

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

                        feedback:
                            raw,

                        improvement:
                            "Try to include all important points from the topic."

                    };

                }



                // =====================================
                // SEND RESULT
                // =====================================

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
            // TYPED ANSWER CHECKING
            // =================================================

            const prompt = `

You are SmartLearn AI,
evaluating a student's theory answer.

================================================
STUDENT EDUCATION
================================================

${education}


================================================
SUBJECT
================================================

${subject}


================================================
TOPIC
================================================

${topic}


================================================
QUESTION
================================================

${question}


================================================
EXPECTED ANSWER
================================================

${
    expectedAnswer ||
    "Evaluate using correct concepts for the question."
}


================================================
STUDENT ANSWER
================================================

${studentAnswer}


================================================
TASK
================================================

Evaluate the student's answer fairly.


================================================
RULES
================================================

1. Give a score from 0 to 5.

2. Award partial marks when
   some concepts are correct.

3. Do not judge grammar harshly
   if the concept is correct.

4. Identify correct points.

5. Identify missing important points.

6. Identify incorrect points.

7. Give simple feedback.

8. Give practical improvement
   suggestions.


================================================
OUTPUT
================================================

Return ONLY valid JSON.

Do not write Markdown.

Use exactly:

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



            // =====================================
            // SEND RESULT
            // =====================================

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

        }


        catch (error) {

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

    }
);
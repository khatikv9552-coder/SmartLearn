from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)


@app.route("/ask-ai", methods=["POST"])
def ask_ai():

    data = request.json

    question = data.get("question", "")

    if not question:
        return jsonify({
            "error": "Question is required"
        }), 400


    response = client.responses.create(

        model="gpt-5",

        instructions="""
        You are SmartLearn AI Assistant.

        Your purpose is to help students learn.

        IMPORTANT RULE:
        NEVER give the direct answer to the exact
        question asked by the student.

        Instead:
        - Explain the related concept.
        - Give step-by-step learning guidance.
        - Give a similar example.
        - Ask the student to try the original question.
        - Do not provide the final answer to the
          student's exact question.

        Adapt explanations to the student's education
        level, subject and topic.
        """,

        input=question
    )


    return jsonify({
        "answer": response.output_text
    })


if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )
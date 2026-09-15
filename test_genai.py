import os

from google import genai

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

try:
    response = client.models.generate_content(
        model="gemini-3-flash-preview", contents="Explain how AI works in a few words"
    )
    print("SUCCESS:")
    print(response.text)
except Exception as e:
    print("ERROR:")
    print(e)

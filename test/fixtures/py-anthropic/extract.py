"""Extract structured data from each document in a loop."""

import anthropic

client = anthropic.Anthropic()


def extract_many(docs):
    results = []
    for doc in docs:
        result = client.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=1024,
            messages=[{"role": "user", "content": doc}],
        )
        results.append(result)
    return results

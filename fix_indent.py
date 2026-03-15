import sys

with open('backend/app.py', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# We lost "if not existing:" around line 2337.
text = text.replace(').first()\n\n                        post = Post(', ').first()\n\n                    if not existing:\n                        post = Post(')

with open('backend/app.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')

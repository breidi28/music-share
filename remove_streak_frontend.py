import sys

with open('src/screens/ProfileScreen.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Remove streak UI block
streak_pattern = re.compile(r'\s*\{\/\* -- Listening Streak Badge ------------------------------- \*\/\}\s*\{profile && profile\.current_streak > 0 && \(\s*<View.*?<\/View>\s*\)\}', re.DOTALL)

text = streak_pattern.sub('', text)

with open('src/screens/ProfileScreen.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Success')

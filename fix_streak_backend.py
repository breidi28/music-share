import sys
import re

with open('backend/app.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove columns
text = re.sub(r'\s*# Listening streaks\s*current_streak = db\.Column.*?\n\s*longest_streak = db\.Column.*?\n', '\n', text)

# 2. Remove from to_dict
text = re.sub(r"\s*'current_streak': self\.current_streak,", '', text)
text = re.sub(r"\s*'longest_streak': self\.longest_streak,", '', text)

# 3. Remove _update_streak method and its call
# It looks like: def _update_streak(user: User) -> None:\n ... \n        user.current_streak = 1\n
text = re.sub(r'\ndef _update_streak\(user: User\) -> None:[\s\S]*?(?=\ndef )', '\n', text)

# 4. Remove the call to _update_streak
text = re.sub(r'\s*# Update user\'s listening streak\s*_update_streak\(user\)\n', '\n', text)

with open('backend/app.py', 'w', encoding='utf-8') as f:
    f.write(text)

print('Success backend streak removal')

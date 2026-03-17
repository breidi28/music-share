import sys

with open('src/screens/ProfileScreen.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if 'Listening Streak Badge' in line:
        skip = True
    if skip and 'Live Now Playing' in line:
        skip = False
    
    if not skip:
        new_lines.append(line)

with open('src/screens/ProfileScreen.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Success frontend streak removal')

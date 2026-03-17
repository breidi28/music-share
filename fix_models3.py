import sys
import re

with open('backend/app.py', 'r', encoding='utf-8') as f:
    text = f.read()

old_code_pattern = re.compile(
    r"post = Post\(\s+"
    r"user_id=user\.id,\s+"
    r"track_title=t\.get\('name', ''\)\[:200\],\s+"
    r"artist=', '\.join\(a\['name'\] for a in t\.get\('artists', \[\]\)\)\[:200\],\s+"
    r"album=t\.get\('album', \{\}\)\.get\('name', ''\)\[:200\],\s+"
    r"album_art_url=\(t\.get\('album', \{\}\)\.get\('images'\) or \[\{\}\]\)\[0\]\.get\('url', ''\)\[:500\],\s+"
    r"caption='',\s+"
    r"post_type='history',\s+"
    r"preview_url=t\.get\('preview_url', ''\)\[:500\] or '',\s+"
    r"spotify_url=t\.get\('external_urls', \{\}\)\.get\('spotify', ''\)\[:500\] or '',\s+"
    r"listened_at=played_at_dt,\s+"
    r"created_at=played_at_dt.*?# use same time so feed aligns chronologically\s*\n\s+\)",
    re.DOTALL
)

new_code = '''post = Post(
                            user_id=user.id,
                            track_title=(t.get('name') or '')[:200],
                            artist=', '.join((a.get('name') or '') for a in (t.get('artists') or []))[:200],
                            album=((t.get('album') or {}).get('name') or '')[:200],
                            album_art_url=(((t.get('album') or {}).get('images') or [{}])[0].get('url') or '')[:500],
                            caption='',
                            post_type='history',
                            preview_url=(t.get('preview_url') or '')[:500],
                            spotify_url=((t.get('external_urls') or {}).get('spotify') or '')[:500],
                            listened_at=played_at_dt,
                            created_at=played_at_dt
                        )'''

if not old_code_pattern.search(text):
    print("Could not find the pattern.")
else:
    new_text = old_code_pattern.sub(new_code, text)
    with open('backend/app.py', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Success")
import sys

with open('backend/app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "preview_url=t.get('preview_url', '')[:500] or ''," in line:
        start_idx = i - 9
        end_idx = i + 5
        break

new_code = '''                        post = Post(
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
                        )
'''

lines[start_idx:end_idx] = [new_code]

with open('backend/app.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Success')

import os
import re

command_dir = 'commands'
files = [f for f in os.listdir(command_dir) if f.endswith('.js')]

results = []

for filename in files:
    path = os.path.join(command_dir, filename)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to find trigger starts
    triggers = re.findall(r"message\.content\.startsWith\('(!|%)(.*?)'\)", content)
    triggers += re.findall(r"message\.content === '(!|%)(.*?)'", content)
    triggers += re.findall(r"cmd === '(!|%)(.*?)'", content)
    triggers += re.findall(r"content\.startsWith\('(!|%)(.*?)'\)", content)
    
    # Deduplicate triggers
    unique_triggers = sorted(list(set([t[0] + t[1] for t in triggers])))
    
    # Check for staff-only
    is_staff = 'Administrator' in content or 'isStaff' in content or 'LEVELS.ADMIN' in content or 'Staff uniquement' in content
    
    # Extract subcommands
    subcommands = re.findall(r"sub === '(.*?)'", content)
    subcommands += re.findall(r"args\[\d+\] === '(.*?)'", content)
    subcommands += re.findall(r"case '(.*?)':", content) # common in switch(sub)
    
    unique_subs = sorted(list(set(subcommands)))
    
    results.append({
        'file': filename,
        'triggers': unique_triggers,
        'subs': unique_subs,
        'staff': is_staff
    })

for res in sorted(results, key=lambda x: x['file']):
    print(f"File: {res['file']}")
    print(f"  Triggers: {', '.join(res['triggers'])}")
    print(f"  Subs: {', '.join(res['subs'])}")
    print(f"  Staff: {res['staff']}")
    print("-" * 20)

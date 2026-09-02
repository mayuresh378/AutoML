"""Generate API documentation from FastAPI backend routes."""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from main import app

DOCS_DIR = os.path.join(os.path.dirname(__file__), '..', 'docs')
os.makedirs(DOCS_DIR, exist_ok=True)

routes = []
for route in app.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods') and '/api/' in route.path:
        routes.append({
            'path': route.path,
            'methods': sorted(route.methods - {'HEAD', 'OPTIONS'}),
            'name': route.name or '',
            'endpoint': route.endpoint.__name__ if hasattr(route, 'endpoint') and route.endpoint else '',
        })

routes.sort(key=lambda r: r['path'])

md = ['# AutoML Platform API Documentation\n']
md.append(f'*Generated on: {__import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M")}*\n')
md.append('---\n')
md.append('| Method | Path | Handler |')
md.append('|--------|------|---------|')

for r in routes:
    methods = ', '.join(r['methods'])
    md.append(f'| {methods} | `{r["path"]}` | `{r["endpoint"]}` |')

md.append('\n---\n')
md.append('## Endpoint Details\n')

for r in routes:
    for m in sorted(r['methods']):
        md.append(f'\n### {m} `{r["path"]}`\n')
        md.append(f'**Handler:** `{r["endpoint"]}`  ')
        md.append(f'**Name:** `{r["name"]}`  ')

doc_path = os.path.join(DOCS_DIR, 'api.md')
with open(doc_path, 'w') as f:
    f.write('\n'.join(md))

print(f'Generated API docs: {doc_path} ({len(routes)} routes)')

# Internal Validation Console Task Review

## Summary

Implemented a backend-only internal validation console served by the `greenfn` service on localhost for personal API verification.

- New local-only console route: `GET /internal/validation`
- New internal operations feed: `GET /internal/validation/operations`
- Five feature buttons map to backend API flows:
  - Contacts Hub
  - Leads Pipeline
  - Today Tasks
  - Interaction History
  - AI Summaries
- Recent Create/Update/Delete traces are captured in-memory from API requests and shown on the internal console.
- Console visibility is restricted:
  - Disabled in production mode
  - Hidden from non-local requests

## Reproducible Run / Validation Commands

```bash
cd greenfn
npm run dev
```

From another terminal, run checks:

```bash
node -e "const http=require('http');http.get('http://localhost:3000/internal/validation',(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{console.log('STATUS',res.statusCode);console.log('HAS_TITLE',d.includes('Internal Validation Console'));console.log('LEN',d.length);});});"

node -e "const http=require('http');const data=JSON.stringify({contactId:'sample-contact',title:'Internal validation create'});const req=http.request('http://localhost:3000/api/tasks',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{console.log('STATUS',res.statusCode);console.log('BODY_HAS_SCAFFOLD',d.includes('scaffolded'));});});req.write(data);req.end();"

node -e "const http=require('http');http.get('http://localhost:3000/internal/validation/operations',(res)=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const p=JSON.parse(d);console.log('STATUS',res.statusCode);console.log('COUNT',p.items.length);console.log('HAS_ONLY_CUD',p.items.every(x=>['CREATE','UPDATE','DELETE'].includes(x.crud)));});});"
```

## Observable Checks

- Internal console returns HTTP 200 and contains `Internal Validation Console` title.
- Read-only calls are intentionally excluded from trace capture.
- Calling write-style feature endpoints creates trace entries.
- Operations feed returns recent items with feature classification and Create/Update/Delete mapping only.
- Console is intended for localhost validation and not for client-facing use.

## File-Type Purpose Rundown

- `greenfn/src/lib/operationTracker.js` — in-memory operation store + Create/Update/Delete-only feature normalization helpers.
- `greenfn/src/middleware/operationRecorder.js` — middleware that records API request outcomes and latency.
- `greenfn/src/modules/internal/routes.js` — local-only HTML console + JSON operations feed routes.
- `greenfn/src/app.js` — mounts recorder middleware and internal validation routes.

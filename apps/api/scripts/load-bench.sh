#!/bin/bash
# Đợt 94 — chạy khi API dev đang chạy ở :3001. Mỗi dòng in: req/s, CPU ms/yêu cầu, độ trễ p50/p99.
JOB=$(curl -s "localhost:3001/jobs?pageSize=1" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log((j.items||j.data)[0].id)})")
node "$(dirname "$0")/load-test.cjs" GET "/public/boot" 50 6
node "$(dirname "$0")/load-test.cjs" GET "/jobs/home-bundle" 50 6
node "$(dirname "$0")/load-test.cjs" GET "/jobs?page=1&pageSize=8&q=nhan" 50 6
node "$(dirname "$0")/load-test.cjs" GET "/jobs?page=1&pageSize=8" 50 6
node "$(dirname "$0")/load-test.cjs" GET "/jobs/$JOB?noview=1" 50 6
node "$(dirname "$0")/load-test.cjs" GET "/presence/count" 50 6
node "$(dirname "$0")/load-test.cjs" POST "/presence/ping" 50 6 '{"sessionId":"RAND"}'
node "$(dirname "$0")/load-test.cjs" POST "/analytics/collect" 50 6 '{"v":"vis-RAND","s":"RAND","ses":{},"pv":[]}'

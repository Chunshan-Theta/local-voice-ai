curl -X POST http://35.244.223.130/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input": "嗨 呃 有什麼事嗎 感覺 好像很久沒跟人聊 "}' \
  --output test.wav
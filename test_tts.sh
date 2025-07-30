curl -X POST http://35.244.223.130/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input": "唉，最近啊，就是那個產線管理系統的專案，狀況有點差，"}' \
  --output test.wav
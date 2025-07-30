curl -X POST http://35.244.223.130/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input": "唉，最近啊，就是那個產線管理系統的專案，狀況有點差，資訊部那邊因為需求不清楚，延遲快一個月了，現在兩個部門氣氛有點緊張，製造部主管還得出來協調，說起來，我也有責任，當初沒跟現場主管好好溝通，直接用舊紀錄寫需求，結果差了好多細節，"}' \
  --output test.wav
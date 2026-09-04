# プレゼン動画

**成果物: `michinavi-pitch.mp4`（4分14秒 / 1920x1080 / 日本語ナレーション付き）**

運営が指定した 5 項目をすべて含み、5 分の上限に対して 46 秒の余裕がある。

| 指定された内容 | 対応する場面 |
| --- | --- |
| プロダクトのコンセプト | 3 |
| 解決したい課題・ターゲット | 2 |
| プロダクトの特徴・主要機能 | 3・5 |
| 実際のプロダクトのデモ | 4・5・6（**実際の画面のスクリーンショット**） |
| チームとして工夫した点・アピールポイント | 7・8・9 |

## 構成

| # | 場面 | 尺 | スライド |
| --- | --- | ---: | --- |
| 1 | みちナビ | 9.0s | 01-title.png |
| 2 | 解決したい課題 | 33.7s | 02-problem.png |
| 3 | コンセプト | 28.8s | 03-concept.png |
| 4 | デモ：ログイン | 12.8s | 04-demo-login.png |
| 5 | デモ：投稿と地図 | 28.7s | 05-demo-map.png |
| 6 | デモ：家族 | 11.3s | 06-demo-family.png |
| 7 | 工夫した点：AIの使い方 | 31.4s | 07-ai.png |
| 8 | 工夫した点：安全とプライバシー | 21.3s | 08-safety.png |
| 9 | 緊急時に触れるのか | 28.0s | 09-emergency.png |
| 10 | いまできること / これから | 16.4s | 10-scope.png |
| 11 | まとめ | 6.4s | 11-closing.png |

ナレーションの全文は [video-narration.json](video-narration.json) にある。
差し替えるときはこのファイルを直す。

## 画面は実物である

場面 4・5・6 に出てくるスマートフォンの画面は、**ローカルで動かした実際のアプリ**を
撮ったものである（審査用アカウントでログインし、`pnpm demo:seed` のデータが
入った状態）。モックではない。

特に場面 5 は、**投稿12件が6つの地点にまとまって地図に出ている**ところを映している。
これが「同じ地点の投稿を1枚にまとめる」という説明の裏付けになる。

## 作り直し方

音声・スライド・結合はすべて手元のツールで完結する（外部サービスを使っていない）。

```bash
# 1. ナレーション音声（macOS の音声合成）
say -v Kyoko -r 190 -o 01-title.aiff "みちナビ。災害時に…"

# 2. スライドは 1920x1080 の HTML を Chrome で撮る
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --window-size=1920,1080 --screenshot=01-title.png file://.../01-title.html

# 3. 静止画＋音声を1場面ずつ mp4 にして、最後に連結
ffmpeg -loop 1 -i 01-title.png -i 01-title.wav -c:v libx264 -tune stillimage \
  -pix_fmt yuv420p -r 30 -c:a aac -shortest 01-title.mp4
ffmpeg -f concat -safe 0 -i list.txt -c copy michinavi-pitch.mp4
```

**声を人が吹き替えたい場合**は、[video-narration.json](video-narration.json) の
`text` をそのまま読めば同じ尺に収まる。音声だけ差し替えて手順3をやり直せばよい。

## 提出のしかた

動画そのものは容量があるため、リポジトリには入れていない。
YouTube の限定公開か Google ドライブに置き、**ログイン不要で視聴できる状態**にして
URL を納品メールに書く（[delivery-email.md](delivery-email.md)）。

## 当日のステージ発表とは別物である

これは提出用の動画で、**最終発表会当日のリアルタイム発表とは別**である。
ステージ用のデッキ（発表者メモと5分のカウントダウン付き）は Artifact として
別に用意してあり、構成も配分も変えてある。

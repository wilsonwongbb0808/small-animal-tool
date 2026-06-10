# 每日小动物

桌面版静态预测工具。网站入口为 `index.html`，线上页面读取：

- `data/history.json`
- `data/latest-review.json`

## 更新网站数据

1. 在本地启动 `启动本地服务.bat`。
2. 本地服务会在每天 21:40 自动从历史开奖接口更新最新一期。
3. 将更新后的 `data/*.json` 和网页静态文件上传到网站。

GitHub Pages 不能运行 `server.mjs`，线上页面只读取已经上传的本地数据。

## 一键上传

双击 `上传到GitHub.bat` 会自动上传最新版静态网页到 GitHub Pages；如果中文文件名在某些电脑上显示异常，也可以运行 `upload-to-github.bat`。

令牌放在本地 `.github-upload-token`，这个文件已加入 `.gitignore`，不要上传到网站。

## 固定预测与复盘逻辑

本地更新最新开奖时，会先用 `data/latest-prediction.json` 里上一期封存的预测生成复盘，再基于更新后的历史库自动跑 1000000 次统计模拟和玄学模拟，生成下一期固定预测。

线上页面读取：

- `data/latest-prediction.json`：当前下一期固定预测
- `data/latest-review.json`：上一期封存预测对最新开奖号的复盘

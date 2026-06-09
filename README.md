# 每日小动物

桌面版静态预测工具。网站入口为 `index.html`，线上页面读取：

- `data/history.json`
- `data/latest-review.json`

## 更新网站数据

1. 在本地启动 `启动本地服务.bat`。
2. 本地服务会在每天 21:40 自动从历史开奖接口更新最新一期。
3. 将更新后的 `data/*.json` 和网页静态文件上传到网站。

GitHub Pages 不能运行 `server.mjs`，线上页面只读取已经上传的本地数据。

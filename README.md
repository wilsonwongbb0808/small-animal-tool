# 小动物预测工具

这是一个静态网页测试版，可以部署到 GitHub Pages。

## GitHub Pages

入口文件是 `index.html`，页面会直接读取：

- `data/history.json`
- `data/latest-review.json`

GitHub Pages 只能托管静态文件，所以线上版本不能直接执行 `server.mjs` 的在线更新接口。需要更新数据时，在本地更新 `data/*.json` 后重新提交到 GitHub。

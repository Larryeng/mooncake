# 月下帶什麼

中秋節攜帶物品清單網站，使用純 HTML、CSS 與 JavaScript，可部署到 GitHub Pages。

## GitHub Pages 部署

1. 在 GitHub 建立一個新的 repository。
2. 將這個資料夾內的所有檔案上傳到 repository 的 `main` 分支。
3. 到 repository 的 **Settings → Pages**。
4. 在 **Build and deployment** 選擇 **GitHub Actions**。
5. 等待 `Deploy to GitHub Pages` workflow 完成。
6. 開啟 GitHub 顯示的網站網址。

網站部署後，操作紀錄後台網址格式為：

```text
https://你的帳號.github.io/你的repository名稱/#admin
```

## 目前版本的資料限制

這是 GitHub Pages 純前端版本，帳號、清單與 Activity Log 都保存於使用者目前瀏覽器的 `localStorage`：

- 同一台裝置、同一個瀏覽器可以保留資料。
- 不同使用者的資料不會跨裝置同步。
- `#admin` 不是安全的管理員權限，只是同一瀏覽器的管理檢視頁。
- 若要真正跨使用者共享資料、驗證管理員身分與集中式 Log，需要接上 Supabase、Firebase 或其他後端服務。

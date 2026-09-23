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

## Supabase 設定

網站使用 Supabase Auth、Postgres 與 Realtime，帳號、清單、認領與操作紀錄可以跨裝置同步。

1. 開啟 Supabase Dashboard 的 **SQL Editor**。
2. 貼上並執行 [supabase.sql](./supabase.sql) 的完整內容。
3. 在 SQL 最後的管理員指令中填入你的登入 Email 並執行：

   ```sql
   update public.profiles set is_admin = true
   where email = '你的 Email';
   ```

4. 如果專案啟用了 Email confirmation，註冊後先到信箱驗證，再登入。

Supabase 的 `anon` / publishable key 可以放在前端；請勿把 `service_role` key 或資料庫密碼放入網站。

# 仓库历史恢复与推送说明（2026-11-07）

## 背景

原仓库 `wxuyu/WxuyuNuxtBlog` 有完整历史；本次需要把代码更新到 **`MineXine/WxuyuNuxtBlog`**，
但直接清空 `.git` 会让目标仓库只剩一条孤立提交，历史断链。
因此流程调整为：**备份日志 → 清空重建 → 推送 → 再把原历史接回来并合并**。

## 本目录内容

| 文件 | 说明 |
| --- | --- |
| `COMMIT_LOG_full_20261107-212615.md` | 原仓库 105 条提交的完整日志（含每次的文件变更统计，3203 行） |
| `COMMIT_LOG_oneline_20261107-212615.txt` | 104 条提交的一行式摘要 |
| `REPO_META_20261107-212615.md` | 清空前的远端 / 分支 / 提交数 / 配置快照 |
| `PUSH_NOTES.md` | 本说明 |

原 `.git` 目录的完整备份在项目外：
`D:/sxiaohe/sxiaohe/nuxt_blog/blog.git-backup-20261107`（119 MB，含全部对象与索引）

## 仓库配置（重建后）

```
origin      → https://github.com/MineXine/WxuyuNuxtBlog.git
分支        → main（跟踪 origin/main）
user.name   → MineXine
user.email  → blog45@qq.com
core.autocrlf = false      core.quotepath = false
fetch.prune  = true         pull.rebase     = false
```

## 历史合并做法

1. `git fetch <备份目录> main:legacy-main` —— 把原 105 条历史作为本地分支引入
2. 比对两棵树：`git diff legacy-main main` → 唯一差异就是本目录 4 个归档文件
   （说明原历史顶端 `20c8955` 已包含今日全部代码改动）
3. `git reset --hard legacy-main` —— 把 `main` 指针移回原历史顶端
4. `git checkout <新提交> -- git-history/` —— 把归档文件取回
5. 提交归档与说明 → 历史变成 **原 105 条 + 今日 1 条**，连续无断裂
6. `git push --force-with-lease origin main` —— 覆盖掉中间那条孤立提交

## 认证提醒

机器上的 Git Credential Manager 同时存着 `wxuyu` 与 `MineXine` 两套 GitHub 凭据，
`git push` 默认取 `wxuyu` 那条，而它对 `MineXine/WxuyuNuxtBlog` 只有 `pull` 权限，
会报 `remote rejected (permission denied)`。

正确写法（token 不进命令行、不落 `.git/config`）：

```bash
git -c credential.username=MineXine push --force-with-lease origin main
```

排查权限用：

```bash
printf "protocol=https\nhost=github.com\nusername=MineXine\n\n" | git credential fill
```

## 现状

- `MineXine/WxuyuNuxtBlog` main = 完整 105 条历史 + 今日归档提交
- 旧仓库 `wxuyu/WxuyuNuxtBlog` 未被改动，保留同样的完整历史

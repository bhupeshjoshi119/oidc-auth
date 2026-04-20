# Git Fork Management Guide

## ✅ Setup Complete

Your repository is now configured with two remotes:

### **Current Remote Configuration:**
```
origin   → https://github.com/bhupeshjoshi119/oidc-auth.git (YOUR fork)
upstream → https://github.com/piyushgarg-dev/oidc-auth.git (MENTOR's repo)
```

---

## 📖 How Fork Remotes Work

### **origin** (Your Fork)
- This is YOUR repository on GitHub
- You have `push` access
- Where you push your own changes
- Default remote for `git push`

### **upstream** (Mentor's Repository)
- This is your MENTOR's original repository
- Read-only (you can fetch but not push)
- Contains the original code and updates
- Used to sync with mentor's latest changes

---

## 🔄 Common Workflows

### **1. Fetch Latest Updates from Mentor**
```bash
git fetch upstream
```
Downloads all branches and commits from mentor's repo without modifying your local files.

**Check what's new:**
```bash
git log --oneline main..upstream/main
```
Shows commits in upstream/main that are not in your main.

---

### **2. Update Your Local Branch with Mentor's Changes**
```bash
# Option A: Rebase (cleaner history)
git rebase upstream/main

# Option B: Merge (keeps commit history)
git merge upstream/main
```

**After rebase/merge, push to your fork:**
```bash
git push origin main
```

---

### **3. Create a Feature Branch from Upstream**
```bash
git fetch upstream
git checkout -b feature/new-feature upstream/main
# Make your changes
git push origin feature/new-feature
```

---

### **4. View What's Ahead/Behind**
```bash
# Your local commits not in upstream
git log upstream/main..HEAD --oneline

# Upstream commits not in your local
git log HEAD..upstream/main --oneline

# Summary
git rev-list --left-right --count HEAD...upstream/main
```

---

## 🎯 Best Practices for Forked Repos

✅ **DO:**
- Fetch from upstream regularly
- Create feature branches for new work
- Push to origin/your-branch
- Keep main branch synced with upstream

❌ **DON'T:**
- Force push to main branch
- Modify upstream (you can't anyway)
- Merge messy history without cleaning
- Forget to sync before starting new features

---

## 📝 Your Current Branches

```bash
# See all branches
git branch -a

# Local branches
git branch

# Remote branches
git branch -r
```

---

## 🔐 Quick Command Reference

| Command | Purpose |
|---------|---------|
| `git fetch upstream` | Get latest from mentor's repo |
| `git merge upstream/main` | Merge mentor's main into yours |
| `git rebase upstream/main` | Rebase your work on mentor's main |
| `git push origin main` | Push to your fork |
| `git log --oneline -n 10` | See last 10 commits |
| `git remote -v` | View all remotes |
| `git status` | Check current state |

---

## 💡 Typical Development Flow

```
1. git fetch upstream          # Get latest from mentor
2. git checkout -b feature     # Create feature branch
3. # Make changes and commit
4. git push origin feature     # Push to your fork
5. Create Pull Request on GitHub
6. When ready to merge:
   - Sync main: git fetch upstream && git merge upstream/main
   - Push: git push origin main
```

---

## ⚠️ If You Get Conflicts

```bash
# When merging/rebasing creates conflicts
git status  # See conflicted files

# Edit conflicted files manually, then:
git add .
git commit -m "Resolve conflicts"  # For merge
# OR
git rebase --continue  # For rebase
```

---

## 🚀 Your Setup is Now:

✅ Forked repo pointing to YOUR GitHub account
✅ Upstream remote pointing to MENTOR's repo
✅ Can fetch updates without pulling to main
✅ Can keep your changes separate
✅ Can create pull requests back to mentor if needed

**You're all set to develop independently while staying synced!** 🎉

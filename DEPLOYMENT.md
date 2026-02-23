# Deployment Guide: Staging to Production Workflow

This project uses a **staging-first deployment workflow** with Vercel. All changes are deployed to staging first, tested, and then promoted to production.

## Branch Structure

- **`staging`** - Staging environment (auto-deploys to Vercel staging)
- **`main`** - Production environment (auto-deploys to Vercel production)

## Workflow Overview

```
Feature Development → staging branch → Test on Staging → Merge to main → Deploy to Production
```

---

# 🖱️ GUI-Only Workflow (GitHub Desktop + Vercel Website)

**No terminal needed!** Use this workflow if you prefer using GitHub Desktop and the Vercel website.

## Initial Setup (One-Time)

### 1. Connect Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository (`nnfofbjs9/gs-sc`)
4. Configure settings:
   - **Framework Preset**: Other (or auto-detect)
   - **Root Directory**: `./`
   - **Build Command**: Leave empty (static site)
   - **Output Directory**: `./`
5. Click **"Deploy"**

### 2. Configure Branch Settings in Vercel

1. In your Vercel project, go to **Settings** → **Git**
2. Under **Production Branch**, ensure it's set to `main`
3. Vercel will automatically create preview deployments for `staging` branch

### 3. Set Up Environment Variables (if needed)

1. Go to **Settings** → **Environment Variables**
2. Add variables separately for:
   - **Production** (applies to `main` branch)
   - **Preview** (applies to `staging` branch)

---

## Daily Workflow with GitHub Desktop

### Step 1: Make Changes and Deploy to Staging

1. **Open GitHub Desktop**
2. **Switch to staging branch**:
   - Click **Current Branch** dropdown (top bar)
   - Select **`staging`**

3. **Make your code changes** in your editor (VS Code, etc.)

4. **Commit changes in GitHub Desktop**:
   - You'll see changed files in the left sidebar
   - Add a commit message in the bottom-left box
   - Click **"Commit to staging"** button

5. **Push to GitHub**:
   - Click **"Push origin"** button (top right)
   - This automatically triggers a Vercel deployment

6. **Check deployment in Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Select your project
   - You'll see a new deployment for the `staging` branch
   - Click on it to get the preview URL (e.g., `https://gs-sc-git-staging.vercel.app`)

### Step 2: Test on Staging

- Visit your staging URL
- Test all changes thoroughly
- Verify everything works as expected

### Step 3: Promote to Production

Once you're satisfied with staging:

1. **Switch to main branch in GitHub Desktop**:
   - Click **Current Branch** dropdown
   - Select **`main`**

2. **Merge staging into main**:
   - Click **Branch** menu (top menu bar)
   - Select **"Merge into Current Branch..."**
   - Choose **`staging`** from the list
   - Click **"Create a merge commit"**

3. **Push to GitHub**:
   - Click **"Push origin"** button
   - This automatically triggers a production deployment on Vercel

4. **Verify production deployment**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - You'll see a new deployment for `main` (marked as Production)
   - Visit your production URL to confirm

---

## Visual Guide: GitHub Desktop Steps

### Switching Branches
```
Click "Current Branch" → Select "staging" or "main"
```

### Committing Changes
```
1. Make code changes
2. See changes in GitHub Desktop sidebar
3. Write commit message (bottom left)
4. Click "Commit to [branch-name]"
```

### Pushing to GitHub
```
Click "Push origin" button (top right)
```

### Merging Branches
```
1. Switch to "main" branch
2. Menu: Branch → Merge into Current Branch
3. Select "staging"
4. Click "Create a merge commit"
5. Push origin
```

---

## Vercel Dashboard Guide

### Viewing Deployments

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click your project
3. You'll see all deployments listed:
   - **Production** deployments (from `main` branch)
   - **Preview** deployments (from `staging` branch)

### Getting Deployment URLs

- Click on any deployment to see its unique URL
- **Staging URL**: Look for deployments from `staging` branch
- **Production URL**: Your main domain (from `main` branch)

### Rolling Back (Emergency)

If something goes wrong in production:

1. Go to **Deployments** tab
2. Find a previous working deployment
3. Click the **⋮** (three dots) menu
4. Select **"Promote to Production"**
5. Confirm - instant rollback!

---

## Quick Reference: GitHub Desktop Workflow

| Step | Action | What Happens |
|------|--------|--------------|
| 1 | Switch to `staging` | Work in staging environment |
| 2 | Make changes + commit | Save your work locally |
| 3 | Push origin | Upload to GitHub → Vercel auto-deploys to staging |
| 4 | Test staging URL | Verify everything works |
| 5 | Switch to `main` | Prepare for production |
| 6 | Merge `staging` into `main` | Bring changes to production branch |
| 7 | Push origin | Upload to GitHub → Vercel auto-deploys to production |

---

## Step-by-Step Deployment Process (CLI Method)

### 1. Develop and Push to Staging

```bash
# Switch to staging branch
git checkout staging

# Make your changes or merge feature branches
git merge feature-branch-name

# Push to staging
git push origin staging
```

Vercel will automatically deploy to your **staging environment**.

### 2. Test on Staging

- Visit your staging URL (e.g., `https://gs-sc-git-staging-yourproject.vercel.app`)
- Thoroughly test all changes
- Verify functionality, UI/UX, and performance

### 3. Promote to Production

Once staging is tested and approved:

```bash
# Switch to main branch
git checkout main

# Merge staging into main
git merge staging

# Push to production
git push origin main
```

Vercel will automatically deploy to your **production environment**.

## Vercel Setup Instructions

### Initial Setup

1. **Install Vercel CLI** (if not already installed):
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Link your project**:
```bash
vercel link
```

Follow the prompts to connect to your existing Vercel project or create a new one.

### Configure Branch Deployments in Vercel Dashboard

1. Go to your project in the [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings** → **Git**
3. Under **Production Branch**, set it to `main`
4. Vercel automatically creates preview deployments for other branches (including `staging`)

### Environment Variables

Make sure to configure environment variables separately for:
- **Production** (main branch)
- **Preview/Staging** (staging branch)

Set these in: **Project Settings** → **Environment Variables**

## Quick Reference Commands

### Deploy to Staging
```bash
git checkout staging
git add .
git commit -m "Your commit message"
git push origin staging
```

### Deploy to Production
```bash
git checkout main
git merge staging
git push origin main
```

### Emergency Rollback
```bash
# Via Vercel Dashboard: Deployments → Select previous deployment → Promote to Production
# OR via CLI:
vercel rollback
```

### Manual Deployment (if needed)
```bash
# Deploy to staging manually
vercel --prod=false

# Deploy to production manually
vercel --prod
```

## Important Notes

- ✅ **Always deploy to staging first**
- ✅ **Test thoroughly on staging before promoting**
- ✅ **Use pull requests** for code review before merging to staging (optional)
- ⚠️ **Never push directly to main** - always go through staging
- ⚠️ **Keep staging and main in sync** - regularly merge main back to staging if hotfixes are applied
- 💡 **GitHub Desktop users**: No need to use terminal commands - follow the GUI workflow above!

## Troubleshooting

### Deployment Failed
- Check Vercel deployment logs in the dashboard (click on the failed deployment)
- Verify all environment variables are set correctly in Vercel settings
- Check the build logs for specific error messages

### Staging and Production Out of Sync

**Using GitHub Desktop:**
1. Switch to `staging` branch
2. Menu: **Branch** → **Merge into Current Branch**
3. Select `main`
4. Click **"Create a merge commit"**
5. Push origin

**Using CLI:**
```bash
git checkout staging
git merge main
git push origin staging
```

### Can't Find Staging URL in Vercel
1. Go to your Vercel project
2. Click **"Deployments"** tab
3. Look for deployments from `staging` branch
4. Click on the deployment to see the preview URL

### GitHub Desktop Not Showing Changes
- Make sure you've saved your files in your code editor
- Try clicking **Repository** → **Refresh** in GitHub Desktop
- Check that you're on the correct branch

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Git Branch Strategy](https://www.atlassian.com/git/tutorials/comparing-workflows)
- Your Vercel Dashboard: https://vercel.com/dashboard

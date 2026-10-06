# CADLift Deployment Guide (Render.com)

## Requirements
- A GitHub account with access to the repository (public or private)
- A Render.com account (free tier works)
- Optional: an Azure OpenAI resource (endpoint, API key, deployment name) for AI features

---

## Step 1: Push to GitHub

```bash
cd ~/CADLift
git add .
git commit -m "Add Render deployment config"
git push origin main
```

---

## Step 2: Create a Render account

1. Go to https://render.com
2. Click **Get Started for Free**
3. Sign in with GitHub (recommended)
4. Verify your email

---

## Step 3: Deploy the backend (API)

### 3.1 Create a web service
1. Dashboard > **New +** > **Web Service**
2. Choose **Build and deploy from a Git repository**
3. Connect the repository: `vishalm/CADLift`

### 3.2 Settings
| Field | Value |
|------|-------|
| **Name** | `cadlift-api` |
| **Region** | Closest to your users |
| **Branch** | `main` |
| **Runtime** | Docker |
| **Dockerfile Path** | `./Dockerfile` |
| **Instance Type** | Free |

### 3.3 Environment variables
**Advanced** > **Add Environment Variable**:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./cadlift.db` |
| `STORAGE_PATH` | `/app/storage` |
| `JWT_SECRET_KEY` | Click **Generate**, or any long random string |
| `LLM_PROVIDER` | `azure` (or `none` to disable AI) |
| `AZURE_OPENAI_ENDPOINT` | `https://<resource>.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | Your key from the Azure portal |
| `AZURE_OPENAI_API_VERSION` | `2025-04-01-preview` |
| `AZURE_DEPLOYMENT_NAME` | `gpt-5-mini` |
| `CORS_ORIGINS` | `https://cadlift-frontend.onrender.com` |
| `LOG_LEVEL` | `INFO` |
| `ENABLE_TASK_QUEUE` | `false` |

### 3.4 Add a disk (file storage)
**Advanced** > **Add Disk**:
- **Name:** `cadlift-storage`
- **Mount Path:** `/app/storage`
- **Size:** 1 GB

### 3.5 Deploy
Click **Create Web Service** and wait about 5-10 minutes.

---

## Step 4: Deploy the frontend (static site)

### 4.1 Create a static site
1. Dashboard > **New +** > **Static Site**
2. Select the same repository

### 4.2 Settings
| Field | Value |
|------|-------|
| **Name** | `cadlift-frontend` |
| **Branch** | `main` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

### 4.3 Environment variable
| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://cadlift-api.onrender.com` |

### 4.4 Add a rewrite rule
**Redirects/Rewrites** > **Add Rule**:
- **Source:** `/*`
- **Destination:** `/index.html`
- **Action:** Rewrite

### 4.5 Deploy
Click **Create Static Site**.

---

## Step 5: Update CORS

Once both services are up, allow the frontend URL on the backend:

1. Open the backend service
2. **Environment** tab
3. Set `CORS_ORIGINS`:
   ```
   https://cadlift-frontend.onrender.com,http://localhost:3000
   ```
4. **Save Changes** (Render redeploys automatically)

---

## Step 6: Test

1. Open `https://cadlift-frontend.onrender.com`
2. Sign up, then sign in
3. Upload a vector PDF floor plan or a DXF file, or try **Prompt to 3D** with "a coffee mug"
4. Open the result in the 3D viewer

---

## What works on Render

| Feature | Status |
|---------|--------|
| PDF floor plan to 3D + AI chat editing | Works (chat needs Azure OpenAI) |
| DXF to 3D | Works |
| DWG to 3D | Needs ODA File Converter in the image |
| Prompt to 3D (precision) | Works (needs Azure OpenAI) |
| Image to 3D (TripoSR) | Needs a GPU, run locally |
| Stable Diffusion | Needs a GPU, run locally |

---

## Troubleshooting

### Build fails
- Check the **Logs** tab
- Check the Dockerfile syntax

### Frontend cannot reach the API
- Check `CORS_ORIGINS` on the backend
- Check `VITE_API_URL` on the frontend (rebuild after changing it)

### First request is slow
- Normal on the free tier (30-60 seconds cold start)
- A cron job hitting `/health` keeps it warm

---

## URLs

- **Frontend:** `https://cadlift-frontend.onrender.com`
- **Backend API:** `https://cadlift-api.onrender.com`
- **API docs:** `https://cadlift-api.onrender.com/docs`
